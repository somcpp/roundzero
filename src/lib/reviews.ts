import { effectiveGate } from "@/lib/judging";
import { createClient } from "@/lib/supabase/server";

// Reads for supabase/migrations/*_judge_scoring.sql and *_judge_links.sql:
// each review of a project (one judge assignment) with its per-criterion
// scores. Most are an assigned judge's; an admin can add their own. RLS limits
// them to the hackathon's owner.

/** One review of one project in one phase: an assigned judge's, or an admin's own. */
export type ProjectReview = {
  /** The judge assignment's id. */
  id: string;
  projectId: string;
  phase: { id: string; name: string; position: number; running: boolean };
  /** The assigned judge; null on an admin's own review. */
  judge: {
    id: string;
    name: string;
    title: string;
    imagePath: string | null;
    /** The secret in their private link, /j/<accessToken>. */
    accessToken: string;
  } | null;
  /** The admin who added this as their own review, on top of the judges'. */
  admin: { id: string; name: string } | null;
  /** Weighted total out of 10, once submitted. */
  total: number | null;
  submittedAt: string | null;
  /** The signed-in user who entered it: an admin, on the judge's behalf or as their own review. */
  submittedBy: string | null;
  notes: string;
  /** Criterion id → 1–10, or true/false for pass/fail criteria. */
  scores: Record<string, number | boolean>;
};

type ReviewRow = {
  id: string;
  project_id: string;
  score: number | string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  notes: string;
  admin_id: string | null;
  admin_name: string;
  judging_phases: { id: string; name: string; position: number; started_at: string | null; closed_at: string | null };
  judges: { id: string; name: string; title: string; image_path: string | null; access_token: string } | null;
  judge_scores: { criterion_id: string; score: number | null; passed: boolean | null }[];
};

// judges is a left join: an admin's own review has none.
const COLUMNS = `id, project_id, score, submitted_at, submitted_by, notes, admin_id, admin_name,
  judging_phases!inner(id, name, position, started_at, closed_at, hackathon_id),
  judges(id, name, title, image_path, access_token),
  judge_scores(criterion_id, score, passed)`;

/** Who a review is by, for sorting and labels. */
export const reviewerName = (r: ProjectReview) => r.judge?.name ?? r.admin?.name ?? "Admin";

function toReview(r: ReviewRow): ProjectReview {
  const ph = r.judging_phases;
  return {
    id: r.id,
    projectId: r.project_id,
    phase: { id: ph.id, name: ph.name, position: ph.position, running: !!ph.started_at && !ph.closed_at },
    judge: r.judges && {
      id: r.judges.id,
      name: r.judges.name,
      title: r.judges.title,
      imagePath: r.judges.image_path,
      accessToken: r.judges.access_token,
    },
    admin: r.admin_id ? { id: r.admin_id, name: r.admin_name || "Admin" } : null,
    // numeric columns come back as numbers or strings depending on size.
    total: r.score === null ? null : Number(r.score),
    submittedAt: r.submitted_at,
    submittedBy: r.submitted_by,
    notes: r.notes,
    scores: Object.fromEntries(
      r.judge_scores.map((s) => [s.criterion_id, s.score ?? (s.passed as boolean)]),
    ),
  };
}

/** Every review of a project, latest phase first; in each, the judges by name, then admins'. */
export async function listProjectReviews(hackathonId: string, projectId: string): Promise<ProjectReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("judge_assignments")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .eq("judging_phases.hackathon_id", hackathonId)
    .returns<ReviewRow[]>();
  if (error) throw new Error(`Couldn't load judge reviews: ${error.message}`);
  return data
    .map(toReview)
    .sort(
      (a, b) =>
        b.phase.position - a.phase.position ||
        Number(!!a.admin) - Number(!!b.admin) ||
        reviewerName(a).localeCompare(reviewerName(b)),
    );
}

/**
 * The project's agent review total and gate result, if the agent has finished.
 * A gate failure the agent-failed inbox overturned counts as a pass.
 */
export async function getAgentResult(
  projectId: string,
): Promise<{ total: number; gatePassed: boolean; gateOverturned: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_reviews")
    .select("status, total, gate_passed, gate_decision")
    .eq("project_id", projectId)
    .maybeSingle<{ status: string; total: number | string | null; gate_passed: boolean | null; gate_decision: string | null }>();
  if (error) throw new Error(`Couldn't load the agent review: ${error.message}`);
  if (!data || data.status !== "done" || data.total === null) return null;
  const gate = effectiveGate(data);
  return { total: Number(data.total), gatePassed: gate.gatePassed !== false, gateOverturned: gate.gateOverturned };
}
