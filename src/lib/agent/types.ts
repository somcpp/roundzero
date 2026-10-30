import type { Mechanism, ModelTier } from "@/lib/data";

// Shapes stored in public.agent_review_steps (supabase/migrations/*_agent_review_workflow.sql)
// and shown on the project page. No server imports, so client components can use them.

export type StepStatus = "queued" | "running" | "done" | "failed" | "skipped";
export type ReviewStatus = "queued" | "running" | "done" | "failed";

/** One point the verdict rests on. */
export type EvidenceItem = { source: string; detail: string; url?: string };

export const FLAG_KINDS = [
  "missing_input",
  "broken_link",
  "unverified_claim",
  "suspicious",
  "prompt_injection",
  "other",
] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];
export type Flag = { kind: FlagKind; note: string };

export const FLAG_LABELS: Record<FlagKind, string> = {
  missing_input: "missing input",
  broken_link: "broken link",
  unverified_claim: "unverified claim",
  suspicious: "suspicious",
  prompt_injection: "prompt injection",
  other: "note",
};

/** One thing the agent did while judging a step, in order. */
export type TraceEntry = {
  at: string;
  kind: "mechanism" | "tool" | "command" | "model" | "note" | "error";
  title: string;
  /** Longer text: a command's output, a page excerpt, a transcript snippet. */
  detail?: string;
  mechanism?: Mechanism;
  url?: string;
  ok?: boolean;
  ms?: number;
};

/** The second opinion on a verdict. */
export type DoubleCheckResult = {
  model: string;
  tier: ModelTier;
  agreed: boolean;
  score: number | null;
  passed: boolean | null;
  confidence: number;
  reasoning: string;
  /** The first verdict, when the check replaced it. */
  first?: { model: string; score: number | null; passed: boolean | null; confidence: number; reasoning: string };
};

export type TokenUsage = { inputTokens: number; outputTokens: number };
