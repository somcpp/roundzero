import type {
  DistributionSettings,
  JudgingPhase,
  ProjectEvent,
  ProjectRecord,
  ProjectValue,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Reads for supabase/migrations/*_create_judging.sql. RLS limits every one to
// the hackathon's owner.

type PhaseRow = {
  id: string;
  name: string;
  judge_group_id: string | null;
  reviews_per_project: number | null;
  advance_count: number | null;
  color: string | null;
  started_at: string | null;
  closed_at: string | null;
};

/** A hackathon's judging phases, in order. */
export async function listPhases(hackathonId: string): Promise<JudgingPhase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("judging_phases")
    .select("id, name, judge_group_id, reviews_per_project, advance_count, color, started_at, closed_at")
    .eq("hackathon_id", hackathonId)
    .order("position")
    .returns<PhaseRow[]>();
  if (error) throw new Error(`Couldn't load the judging phases: ${error.message}`);
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    judgeGroupId: p.judge_group_id,
    reviewsPerProject: p.reviews_per_project,
    advanceCount: p.advance_count,
    color: p.color,
    startedAt: p.started_at,
    closedAt: p.closed_at,
  }));
}

export const DEFAULT_DISTRIBUTION: DistributionSettings = {
  agentFirst: true,
  failedInbox: "admin",
  inboxJudgeId: null,
  strategy: "even",
  cadence: "once",
  batchDays: 5,
  showAgentScore: true,
  judgeGate: "rule_out",
  judgeGateCount: 2,
};

type DistributionRow = {
  agent_first: boolean;
  failed_inbox: DistributionSettings["failedInbox"];
  inbox_judge_id: string | null;
  strategy: DistributionSettings["strategy"];
  cadence: DistributionSettings["cadence"];
  batch_days: number;
  show_agent_score: boolean;
  judge_gate: DistributionSettings["judgeGate"];
  judge_gate_count: number;
};

/** A hackathon's distribution settings, or the defaults if they were never saved. */
export async function getDistribution(hackathonId: string): Promise<DistributionSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("distribution_settings")
    .select(
      "agent_first, failed_inbox, inbox_judge_id, strategy, cadence, batch_days, show_agent_score, judge_gate, judge_gate_count",
    )
    .eq("hackathon_id", hackathonId)
    .maybeSingle<DistributionRow>();
  if (error) throw new Error(`Couldn't load distribution settings: ${error.message}`);
  if (!data) return DEFAULT_DISTRIBUTION;
  // A deleted inbox judge (inbox_judge_id set null) hands the inbox back to the admin.
  const judge = data.failed_inbox === "judge" ? data.inbox_judge_id : null;
  return {
    agentFirst: data.agent_first,
    failedInbox: data.failed_inbox === "judge" && !judge ? "admin" : data.failed_inbox,
    inboxJudgeId: judge,
    strategy: data.strategy,
    cadence: data.cadence,
    batchDays: data.batch_days,
    showAgentScore: data.show_agent_score,
    judgeGate: data.judge_gate,
    judgeGateCount: data.judge_gate_count,
  };
}

type ProjectRow = {
  id: string;
  number: number;
  phase_id: string | null;
  status: ProjectRecord["status"];
  final_rank: number | null;
  contact_email: string;
  created_at: string;
  updated_at: string;
  project_values: { block_id: string; value: ProjectValue }[];
};

const PROJECT_COLUMNS =
  "id, number, phase_id, status, final_rank, contact_email, created_at, updated_at, project_values(block_id, value)";

function toProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    number: row.number,
    phaseId: row.phase_id,
    status: row.status,
    finalRank: row.final_rank,
    contactEmail: row.contact_email ?? "",
    values: Object.fromEntries(row.project_values.map((v) => [v.block_id, v.value])),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A hackathon's projects, newest number first. */
export async function listProjects(hackathonId: string): Promise<ProjectRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("hackathon_id", hackathonId)
    .order("number", { ascending: false })
    .returns<ProjectRow[]>();
  if (error) throw new Error(`Couldn't load projects: ${error.message}`);
  return data.map(toProject);
}

type EventRow = {
  id: string;
  kind: ProjectEvent["kind"];
  actor_kind: ProjectEvent["actorKind"];
  actor_id: string | null;
  actor_name: string;
  data: Record<string, unknown>;
  created_at: string;
};

/** One project by its number, with its audit trail newest first, or null. */
export async function getProjectWithEvents(
  hackathonId: string,
  number: number,
): Promise<{ project: ProjectRecord; events: ProjectEvent[] } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`${PROJECT_COLUMNS}, project_events(id, kind, actor_kind, actor_id, actor_name, data, created_at)`)
    .eq("hackathon_id", hackathonId)
    .eq("number", number)
    .order("created_at", { referencedTable: "project_events", ascending: false })
    .maybeSingle<ProjectRow & { project_events: EventRow[] }>();
  if (error) throw new Error(`Couldn't load the project: ${error.message}`);
  if (!data) return null;
  return {
    project: toProject(data),
    events: data.project_events.map((e) => ({
      id: e.id,
      kind: e.kind,
      actorKind: e.actor_kind,
      actorId: e.actor_id,
      actorName: e.actor_name,
      data: e.data,
      createdAt: e.created_at,
    })),
  };
}

/** How many projects a hackathon has, and how many are still in the running. */
export async function countProjects(hackathonId: string): Promise<{ total: number; active: number }> {
  const supabase = await createClient();
  const [total, active] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("hackathon_id", hackathonId),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("hackathon_id", hackathonId)
      .eq("status", "active"),
  ]);
  const error = total.error ?? active.error;
  if (error) throw new Error(`Couldn't count projects: ${error.message}`);
  return { total: total.count ?? 0, active: active.count ?? 0 };
}

export type Assignment = {
  phaseId: string;
  projectId: string;
  /** Null on an admin's own review, which adds a score without being an assignment. */
  judgeId: string | null;
  score: number | null;
  submittedAt: string | null;
};

export type AgentReview = {
  projectId: string;
  status: "queued" | "running" | "done" | "failed";
  total: number | null;
  /** Whether every gate passed, as it counts: a failure the inbox overturned counts as a pass. */
  gatePassed: boolean | null;
  /** The agent failed a gate and the inbox overturned it. */
  gateOverturned: boolean;
  /** Steps waiting on a person. */
  flagged: number;
};

type AssignmentRow = {
  phase_id: string;
  project_id: string;
  judge_id: string | null;
  score: number | null;
  submitted_at: string | null;
};

type AgentReviewRow = {
  project_id: string;
  status: AgentReview["status"];
  total: number | null;
  gate_passed: boolean | null;
  gate_decision: "upheld" | "overturned" | null;
  flagged: number;
};

/** The agent's gate verdict as it counts: an overturned failure is a pass. */
export const effectiveGate = (r: { gate_passed: boolean | null; gate_decision?: string | null }) => {
  const overturned = r.gate_passed === false && r.gate_decision === "overturned";
  return { gatePassed: overturned ? true : r.gate_passed, gateOverturned: overturned };
};

/** Every judge assignment and agent review for a hackathon, for the progress page. */
export async function getJudgingActivity(
  hackathonId: string,
): Promise<{ assignments: Assignment[]; agentReviews: AgentReview[] }> {
  const supabase = await createClient();
  const [assignments, reviews] = await Promise.all([
    supabase
      .from("judge_assignments")
      .select("phase_id, project_id, judge_id, score, submitted_at, judging_phases!inner(hackathon_id)")
      .eq("judging_phases.hackathon_id", hackathonId)
      .returns<AssignmentRow[]>(),
    supabase
      .from("agent_reviews")
      .select("project_id, status, total, gate_passed, gate_decision, flagged, projects!inner(hackathon_id)")
      .eq("projects.hackathon_id", hackathonId)
      .returns<AgentReviewRow[]>(),
  ]);
  const error = assignments.error ?? reviews.error;
  if (error) throw new Error(`Couldn't load judging progress: ${error.message}`);
  return {
    assignments: assignments.data!.map((a) => ({
      phaseId: a.phase_id,
      projectId: a.project_id,
      judgeId: a.judge_id,
      // numeric columns come back as numbers or strings depending on size.
      score: a.score === null ? null : Number(a.score),
      submittedAt: a.submitted_at,
    })),
    agentReviews: reviews.data!.map((r) => ({
      projectId: r.project_id,
      status: r.status,
      total: r.total === null ? null : Number(r.total),
      ...effectiveGate(r),
      flagged: r.flagged,
    })),
  };
}
