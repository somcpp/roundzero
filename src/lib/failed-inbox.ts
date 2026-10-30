import { toGate, type GateDecision } from "@/lib/agent-reviews";
import type { FailedInboxOwner, ProjectStatus, ProjectValue } from "@/lib/data";
import { getDistribution } from "@/lib/judging";
import { projectHeadline } from "@/lib/project-fields";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

// Reads for supabase/migrations/*_failed_inbox.sql: projects the agent failed
// on a gate, waiting on the inbox's call or already decided. RLS limits them
// to the hackathon's owner.

export type FailedInboxSummary = {
  owner: FailedInboxOwner;
  /** Failures on projects still in the running that nobody has decided on. */
  pending: number;
  decided: number;
};

/** Counts for the Inbox button in the top bar. Null when they can't be read, so the bar never breaks. */
export async function getFailedInboxSummary(hackathonId: string): Promise<FailedInboxSummary | null> {
  try {
    const supabase = await createClient();
    const [reviews, distribution] = await Promise.all([
      supabase
        .from("agent_reviews")
        .select("gate_decision, projects!inner(hackathon_id, status)")
        .eq("projects.hackathon_id", hackathonId)
        .eq("gate_passed", false)
        .returns<{ gate_decision: string | null; projects: { status: ProjectStatus } }[]>(),
      getDistribution(hackathonId),
    ]);
    if (reviews.error) return null;
    return {
      owner: distribution.failedInbox,
      pending: reviews.data.filter((r) => !r.gate_decision && r.projects.status === "active").length,
      decided: reviews.data.filter((r) => r.gate_decision).length,
    };
  } catch {
    return null;
  }
}

/** A gate the agent failed the project on, as it counts. */
export type FailedGate = {
  criterionId: string;
  title: string;
  /** Why: the agent's reasoning, or the admin's note when they overrode the step to a fail. */
  reason: string;
  overridden: boolean;
};

export type FailedInboxItem = {
  projectId: string;
  number: number;
  name: string;
  pitch: string;
  status: ProjectStatus;
  agentTotal: number | null;
  /** The agent's write-up, for when no gate step explains it. */
  summary: string;
  gates: FailedGate[];
  decision: GateDecision | null;
};

export type FailedInbox = {
  owner: FailedInboxOwner;
  /** Whose inbox it is, when it's a judge's. */
  judge: { name: string; title: string; imagePath: string | null } | null;
  /** Waiting on a call: projects still in the running, by number. */
  pending: FailedInboxItem[];
  /** Newest call first. */
  decided: FailedInboxItem[];
};

type Row = {
  project_id: string;
  total: number | string | null;
  summary: string;
  gate_passed: boolean | null;
  gate_decision: GateDecision["decision"] | null;
  gate_decision_note: string;
  gate_decided_at: string | null;
  gate_eliminated: boolean;
  projects: { number: number; status: ProjectStatus; project_values: { block_id: string; value: ProjectValue }[] };
  agent_review_steps: {
    criterion_id: string;
    passed: boolean | null;
    override_passed: boolean | null;
    override_note: string;
    reasoning: string;
    criteria: { title: string; position: number; gate: boolean; scale: string } | null;
  }[];
};

const COLUMNS =
  "project_id, total, summary, gate_passed, gate_decision, gate_decision_note, gate_decided_at, gate_eliminated, " +
  "projects!inner(number, status, hackathon_id, project_values(block_id, value)), " +
  "agent_review_steps(criterion_id, passed, override_passed, override_note, reasoning, criteria(title, position, gate, scale))";

/** Every project the agent failed on a gate, split into waiting and decided. */
export async function getFailedInbox(hackathonId: string): Promise<FailedInbox> {
  const supabase = await createClient();
  const [{ data, error }, blocks, distribution] = await Promise.all([
    supabase
      .from("agent_reviews")
      .select(COLUMNS)
      .eq("projects.hackathon_id", hackathonId)
      .eq("gate_passed", false)
      .returns<Row[]>(),
    listSchemaBlocks(hackathonId),
    getDistribution(hackathonId),
  ]);
  if (error) throw new Error(`Couldn't load the agent-failed inbox: ${error.message}`);

  let judge: FailedInbox["judge"] = null;
  if (distribution.failedInbox === "judge" && distribution.inboxJudgeId) {
    const { data: j } = await supabase
      .from("judges")
      .select("name, title, image_path")
      .eq("id", distribution.inboxJudgeId)
      .maybeSingle<{ name: string; title: string; image_path: string | null }>();
    if (j) judge = { name: j.name, title: j.title, imagePath: j.image_path };
  }

  const items = data.map((r): FailedInboxItem => {
    const values = Object.fromEntries(r.projects.project_values.map((v) => [v.block_id, v.value]));
    const { name, pitch } = projectHeadline({ number: r.projects.number, values }, blocks);
    const gates = r.agent_review_steps
      .filter((s) => s.criteria?.gate && s.criteria.scale === "pass_fail" && (s.override_passed ?? s.passed) === false)
      .sort((a, b) => a.criteria!.position - b.criteria!.position)
      .map((s) => {
        const overridden = s.override_passed === false;
        return {
          criterionId: s.criterion_id,
          title: s.criteria!.title,
          reason: (overridden && s.override_note) || s.reasoning,
          overridden,
        };
      });
    return {
      projectId: r.project_id,
      number: r.projects.number,
      name,
      pitch,
      status: r.projects.status,
      agentTotal: r.total === null ? null : Number(r.total),
      summary: r.summary,
      gates,
      decision: toGate(r).gateDecision,
    };
  });

  return {
    owner: distribution.failedInbox,
    judge,
    pending: items.filter((i) => !i.decision && i.status === "active").sort((a, b) => a.number - b.number),
    decided: items
      .filter((i) => i.decision)
      .sort((a, b) => b.decision!.decidedAt.localeCompare(a.decision!.decidedAt)),
  };
}
