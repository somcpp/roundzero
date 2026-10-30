import type { Mechanism, ModelTier } from "@/lib/data";
import type { DoubleCheckResult, EvidenceItem, Flag, ReviewStatus, StepStatus, TokenUsage, TraceEntry } from "@/lib/agent/types";
import { effectiveGate } from "@/lib/judging";
import { createClient } from "@/lib/supabase/server";

// Reads for supabase/migrations/*_agent_review_workflow.sql: a project's
// agent review with its steps, and the steps across a hackathon that are
// waiting on a person. RLS limits them to the hackathon's owner.

export type AgentStepView = {
  id: string;
  criterionId: string;
  status: StepStatus;
  /** Direction an admin gave this step for this project. */
  guidance: string;
  modelTier: ModelTier | null;
  activity: string;
  score: number | null;
  passed: boolean | null;
  confidence: number | null;
  reasoning: string;
  feedback: string;
  evidence: EvidenceItem[];
  flags: Flag[];
  needsReview: boolean;
  reviewReason: string;
  doubleCheck: DoubleCheckResult | null;
  trace: TraceEntry[];
  mechanisms: Mechanism[];
  model: string | null;
  usage: TokenUsage | null;
  error: string | null;
  override: { score: number | null; passed: boolean | null; note: string } | null;
  resolvedAt: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

/** The agent-failed inbox's call on a failed gate (supabase/migrations/*_failed_inbox.sql). */
export type GateDecision = {
  decision: "upheld" | "overturned";
  note: string;
  decidedAt: string;
  /** Upheld and eliminated in one go. */
  eliminated: boolean;
};

export type AgentReviewView = {
  status: ReviewStatus;
  total: number | null;
  /** Whether every gate passed, as it counts: a failure the inbox overturned counts as a pass. */
  gatePassed: boolean | null;
  /** The inbox's call when the agent failed a gate; null until someone decides. */
  gateDecision: GateDecision | null;
  flagged: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  guidance: string;
  modelTier: ModelTier | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  steps: AgentStepView[];
};

type StepRow = {
  id: string;
  criterion_id: string;
  status: StepStatus;
  guidance: string;
  model_tier: ModelTier | null;
  activity: string;
  score: number | null;
  passed: boolean | null;
  confidence: number | string | null;
  reasoning: string;
  feedback: string;
  evidence: EvidenceItem[];
  flags: Flag[];
  needs_review: boolean;
  review_reason: string;
  double_check: DoubleCheckResult | null;
  trace: TraceEntry[];
  mechanisms: Mechanism[];
  model: string | null;
  usage: TokenUsage | null;
  error: string | null;
  override_score: number | null;
  override_passed: boolean | null;
  override_note: string;
  resolved_at: string | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type ReviewRow = {
  status: ReviewStatus;
  total: number | string | null;
  gate_passed: boolean | null;
  gate_decision: GateDecision["decision"] | null;
  gate_decision_note: string;
  gate_decided_at: string | null;
  gate_eliminated: boolean;
  flagged: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  guidance: string;
  model_tier: ModelTier | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  agent_review_steps: StepRow[];
};

const toStep = (s: StepRow): AgentStepView => ({
  id: s.id,
  criterionId: s.criterion_id,
  status: s.status,
  guidance: s.guidance,
  modelTier: s.model_tier,
  activity: s.activity,
  score: s.score,
  passed: s.passed,
  // numeric columns come back as numbers or strings depending on size.
  confidence: s.confidence === null ? null : Number(s.confidence),
  reasoning: s.reasoning,
  feedback: s.feedback,
  evidence: s.evidence,
  flags: s.flags,
  needsReview: s.needs_review,
  reviewReason: s.review_reason,
  doubleCheck: s.double_check,
  trace: s.trace,
  mechanisms: s.mechanisms,
  model: s.model,
  usage: s.usage,
  error: s.error,
  override:
    s.override_score !== null || s.override_passed !== null
      ? { score: s.override_score, passed: s.override_passed, note: s.override_note }
      : null,
  resolvedAt: s.resolved_at,
  queuedAt: s.queued_at,
  startedAt: s.started_at,
  finishedAt: s.finished_at,
});

/** The gate as it counts, and the inbox's call on it. */
export function toGate(r: Pick<ReviewRow, "gate_passed" | "gate_decision" | "gate_decision_note" | "gate_decided_at" | "gate_eliminated">) {
  const { gatePassed } = effectiveGate(r);
  const gateDecision: GateDecision | null =
    r.gate_passed === false && r.gate_decision && r.gate_decided_at
      ? { decision: r.gate_decision, note: r.gate_decision_note, decidedAt: r.gate_decided_at, eliminated: r.gate_eliminated }
      : null;
  return { gatePassed, gateDecision };
}

/** A project's agent review with every step, or null if the agent hasn't been asked yet. */
export async function getAgentReview(projectId: string): Promise<AgentReviewView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_reviews")
    .select(
      "status, total, gate_passed, gate_decision, gate_decision_note, gate_decided_at, gate_eliminated, flagged, summary, strengths, improvements, guidance, model_tier, queued_at, started_at, finished_at, error, agent_review_steps(*)",
    )
    .eq("project_id", projectId)
    .maybeSingle<ReviewRow>();
  if (error) throw new Error(`Couldn't load the agent review: ${error.message}`);
  if (!data) return null;
  return {
    status: data.status,
    total: data.total === null ? null : Number(data.total),
    ...toGate(data),
    flagged: data.flagged,
    summary: data.summary,
    strengths: data.strengths,
    improvements: data.improvements,
    guidance: data.guidance,
    modelTier: data.model_tier,
    queuedAt: data.queued_at,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    error: data.error,
    steps: data.agent_review_steps.map(toStep),
  };
}

export type FlaggedStep = {
  stepId: string;
  projectNumber: number;
  criterionTitle: string;
  reason: string;
  score: number | null;
  passed: boolean | null;
  failed: boolean;
};

/** Steps across a hackathon waiting on a person, by project number. */
export async function listFlaggedSteps(hackathonId: string): Promise<FlaggedStep[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_review_steps")
    .select("id, status, score, passed, review_reason, criteria!inner(title, position), agent_reviews!inner(projects!inner(number, hackathon_id))")
    .eq("needs_review", true)
    .eq("agent_reviews.projects.hackathon_id", hackathonId)
    .returns<
      {
        id: string;
        status: StepStatus;
        score: number | null;
        passed: boolean | null;
        review_reason: string;
        criteria: { title: string; position: number };
        agent_reviews: { projects: { number: number } };
      }[]
    >();
  if (error) throw new Error(`Couldn't load flagged steps: ${error.message}`);
  return data
    .sort(
      (a, b) =>
        a.agent_reviews.projects.number - b.agent_reviews.projects.number || a.criteria.position - b.criteria.position,
    )
    .map((s) => ({
      stepId: s.id,
      projectNumber: s.agent_reviews.projects.number,
      criterionTitle: s.criteria.title,
      reason: s.review_reason,
      score: s.score,
      passed: s.passed,
      failed: s.status === "failed",
    }));
}
