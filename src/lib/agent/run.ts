import { checkTier } from "@/lib/ai";
import { listCriteria } from "@/lib/criteria";
import type { Criterion, Mechanism, ModelTier, ProjectValue, SchemaBlock } from "@/lib/data";
import { startAgentInboxEmail } from "@/lib/email/runs";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";
import { collectEvidence, ProjectResources, resolveInputs, submissionText } from "./collect";
import { clip } from "./fetch";
import {
  doubleCheck,
  investigate,
  judgeVerdict,
  summarize,
  TOOL_BUDGET,
  verdictLabel,
  verdictsAgree,
  wantsDoubleCheck,
  type JudgeInput,
  type Verdict,
} from "./judge";
import { StepRecorder } from "./recorder";
import { investigationTools } from "./tools";
import type { DoubleCheckResult, Flag } from "./types";

// Running the agent. A worker claims queued reviews one at a time (several
// workers can share the queue), and each review runs its criteria as steps,
// a few at once: gather evidence with the criterion's mechanisms, investigate
// with tools, score as strict JSON, and double-check when unsure. Everything
// runs as the signed-in admin, so RLS applies throughout.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** How long one worker keeps claiming reviews. On Vercel, maxDuration caps it; unfinished reviews are picked up again later. */
const WORKER_BUDGET_MS = Number(process.env.AGENT_WORKER_BUDGET_MS) || 25 * 60_000;
/** One step's time limit, sandbox runs included. */
const STEP_TIMEOUT_MS = 14 * 60_000;
const STEPS_AT_ONCE = 3;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const judgesOnly = (c: Criterion) => c.mechanisms.length > 0 && c.mechanisms.every((m) => m === "human_only");

/** The mechanisms the agent runs for a criterion; none chosen means just reading the submission. */
const agentMechanisms = (c: Criterion): Mechanism[] => {
  const ms = c.mechanisms.filter((m) => m !== "human_only");
  return ms.length ? ms : ["agent_judge"];
};

export type StepRow = {
  id: string;
  criterion_id: string;
  status: string;
  guidance: string;
  model_tier: ModelTier | null;
  score: number | null;
  passed: boolean | null;
  override_score: number | null;
  override_passed: boolean | null;
};

export type ReviewEnv = {
  supabase: Supabase;
  hackathon: { id: string; name: string; tagline: string };
  blocks: SchemaBlock[];
  criteria: Criterion[];
  project: { id: string; number: number; values: Record<string, ProjectValue> };
  review: { guidance: string; modelTier: ModelTier | null };
  steps: StepRow[];
  resources: ProjectResources;
};

const STEP_COLUMNS = "id, criterion_id, status, guidance, model_tier, score, passed, override_score, override_passed";

async function loadEnv(supabase: Supabase, hackathonId: string, projectId: string): Promise<ReviewEnv> {
  const [hackathon, blocks, criteria, project, review, steps] = await Promise.all([
    supabase.from("hackathons").select("id, name, tagline").eq("id", hackathonId).single<{ id: string; name: string; tagline: string }>(),
    listSchemaBlocks(hackathonId),
    listCriteria(hackathonId),
    supabase
      .from("projects")
      .select("id, number, project_values(block_id, value)")
      .eq("id", projectId)
      .eq("hackathon_id", hackathonId)
      .single<{ id: string; number: number; project_values: { block_id: string; value: ProjectValue }[] }>(),
    supabase
      .from("agent_reviews")
      .select("guidance, model_tier")
      .eq("project_id", projectId)
      .single<{ guidance: string; model_tier: ModelTier | null }>(),
    supabase.from("agent_review_steps").select(STEP_COLUMNS).eq("project_id", projectId).returns<StepRow[]>(),
  ]);
  const error = hackathon.error ?? project.error ?? review.error ?? steps.error;
  if (error) throw new Error(`Couldn't load the project for the agent: ${error.message}`);
  return {
    supabase,
    hackathon: hackathon.data!,
    blocks,
    criteria,
    project: {
      id: project.data!.id,
      number: project.data!.number,
      values: Object.fromEntries(project.data!.project_values.map((v) => [v.block_id, v.value])),
    },
    review: { guidance: review.data!.guidance, modelTier: review.data!.model_tier },
    steps: steps.data!,
    resources: new ProjectResources(),
  };
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

// ── Workers ───────────────────────────────────────────────────────────────

/**
 * Work through a hackathon's queue until it's empty or the time budget runs
 * out, then email the owner any new gate failures waiting on a call.
 */
export async function runAgentWorker(hackathonId: string, { workers = 2 }: { workers?: number } = {}) {
  const supabase = await createClient();
  const deadline = Date.now() + WORKER_BUDGET_MS;
  const work = async () => {
    while (Date.now() < deadline) {
      const { data, error } = await supabase.rpc("claim_agent_review", { p_hackathon_id: hackathonId });
      if (error) return console.error("[agent] couldn't claim a review:", error.message);
      if (!data) return;
      await reviewProject(supabase, hackathonId, data as string);
    }
  };
  await Promise.all(Array.from({ length: workers }, work));
  await startAgentInboxEmail(hackathonId);
}

/** Review one claimed project from start to finish. Never throws: failures land on the review. */
async function reviewProject(supabase: Supabase, hackathonId: string, projectId: string) {
  try {
    let env = await loadEnv(supabase, hackathonId, projectId);

    // One step per criterion; judges-only criteria are skipped, not scored.
    const have = new Set(env.steps.map((s) => s.criterion_id));
    const fresh = env.criteria.filter((c) => !have.has(c.id));
    if (fresh.length) {
      const { error } = await supabase.from("agent_review_steps").upsert(
        fresh.map((c) => ({
          project_id: projectId,
          criterion_id: c.id,
          status: judgesOnly(c) ? "skipped" : "queued",
          mechanisms: c.mechanisms,
        })),
        { onConflict: "project_id,criterion_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`Couldn't set up the review's steps: ${error.message}`);
      env = await loadEnv(supabase, hackathonId, projectId);
    }

    // "running" here means an earlier worker died mid-step, so it runs again.
    const todo = env.steps.filter((s) => s.status === "queued" || s.status === "running");
    await pool(todo, STEPS_AT_ONCE, (step) => runStep(env, step));

    const writeUp = await writeUpReview(env);
    const { error } = await supabase.rpc("finish_agent_review", {
      p_project_id: projectId,
      p_summary: writeUp.summary,
      p_strengths: writeUp.strengths,
      p_improvements: writeUp.improvements,
    });
    if (error) throw new Error(`Couldn't save the review: ${error.message}`);
  } catch (e) {
    console.error("[agent] review failed:", e);
    await supabase
      .from("agent_reviews")
      .update({ status: "failed", error: clip(message(e), 2000), finished_at: new Date().toISOString() })
      .eq("project_id", projectId);
  }
}

/**
 * Run one step again (queued by queue_agent_step), then bring the review's
 * total and write-up up to date and log the change to the audit trail.
 */
export async function runSingleStep(hackathonId: string, projectId: string, stepId: string) {
  const supabase = await createClient();
  try {
    const env = await loadEnv(supabase, hackathonId, projectId);
    const step = env.steps.find((s) => s.id === stepId);
    if (!step) return;
    const criterion = env.criteria.find((c) => c.id === step.criterion_id);
    const before = step.override_score ?? step.override_passed ?? step.score ?? step.passed;

    await runStep(env, step);

    const { data: after } = await supabase
      .from("agent_review_steps")
      .select("status, score, passed, model, needs_review")
      .eq("id", stepId)
      .single<{ status: string; score: number | null; passed: boolean | null; model: string | null; needs_review: boolean }>();
    await supabase.rpc("refresh_agent_review", { p_project_id: projectId });
    await supabase.from("project_events").insert({
      project_id: projectId,
      kind: "agent_rescored",
      data: {
        criterion: criterion?.title ?? "A criterion",
        from: before,
        to: after?.score ?? after?.passed ?? null,
        failed: after?.status === "failed",
        flagged: after?.needs_review ?? false,
        model: after?.model ?? null,
        guidance: step.guidance || undefined,
      },
    });

    // The write-up mentions every step, so it's redone to match.
    const writeUp = await writeUpReview(env, "quick");
    if (writeUp.summary) await supabase.from("agent_reviews").update(writeUp).eq("project_id", projectId);
  } catch (e) {
    console.error("[agent] re-running a step failed:", e);
  }
}

// ── One step ──────────────────────────────────────────────────────────────

async function runStep(env: ReviewEnv, step: StepRow) {
  const { supabase } = env;
  const criterion = env.criteria.find((c) => c.id === step.criterion_id);
  if (!criterion) return;
  if (judgesOnly(criterion)) {
    await supabase.from("agent_review_steps").update({ status: "skipped", mechanisms: criterion.mechanisms, activity: "" }).eq("id", step.id);
    return;
  }

  const rec = new StepRecorder(supabase, step.id);
  const mechanisms = agentMechanisms(criterion);
  await supabase
    .from("agent_review_steps")
    .update({ status: "running", started_at: new Date().toISOString(), activity: "Starting", error: null, trace: [], mechanisms })
    .eq("id", step.id);

  try {
    const result = await judgeStep(env, criterion, step, mechanisms, rec, AbortSignal.timeout(STEP_TIMEOUT_MS));
    await rec.close();
    const v = result.verdict;
    const { error } = await supabase
      .from("agent_review_steps")
      .update({
        status: "done",
        activity: "",
        finished_at: new Date().toISOString(),
        score: criterion.scale === "score" ? v.score : null,
        passed: criterion.scale === "pass_fail" ? v.passed : null,
        confidence: Math.round(v.confidence * 100) / 100,
        reasoning: v.reasoning,
        feedback: v.feedback,
        evidence: v.evidence,
        flags: v.flags,
        needs_review: v.needsHumanReview,
        review_reason: v.needsHumanReview ? clip(v.reviewReason || "The agent asked for a person to look.", 1900) : "",
        double_check: result.doubleCheck,
        trace: rec.trace,
        model: result.model,
        usage: rec.usage,
        // A new verdict replaces any earlier call on the old one.
        override_score: null,
        override_passed: null,
        override_note: "",
        resolved_by: null,
        resolved_at: null,
      })
      .eq("id", step.id);
    if (error) throw new Error(`Couldn't save the verdict: ${error.message}`);
  } catch (e) {
    const why = clip(message(e), 1500);
    rec.add({ kind: "error", title: "The step failed", detail: why, ok: false });
    await rec.close();
    await supabase
      .from("agent_review_steps")
      .update({
        status: "failed",
        activity: "",
        error: why,
        needs_review: true,
        review_reason: `The agent couldn't finish this step: ${why}`,
        trace: rec.trace,
        usage: rec.usage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", step.id);
  }
}

type StepResult = { verdict: Verdict; model: string; doubleCheck: DoubleCheckResult | null };

export async function judgeStep(
  env: ReviewEnv,
  criterion: Criterion,
  step: StepRow,
  mechanisms: Mechanism[],
  rec: StepRecorder,
  signal: AbortSignal,
): Promise<StepResult> {
  const tier: ModelTier = step.model_tier ?? env.review.modelTier ?? criterion.agentModel;
  const guidance = [
    { from: "criterion", text: criterion.agentGuidance.trim() },
    { from: "this run", text: env.review.guidance.trim() },
    { from: "this project", text: step.guidance.trim() },
  ].filter((g) => g.text);
  const inputs = resolveInputs(criterion, env.blocks, env.project.values);

  // Nothing submitted and the rule says that's a 0: no model needed.
  if (inputs.filled.length === 0 && criterion.ifMissing === "zero") {
    const names = inputs.blocks.map((b) => b.title).join(", ") || "inputs";
    const reasoning = `Nothing was submitted for ${names}, and this criterion scores missing inputs as ${criterion.scale === "score" ? "0" : "a fail"}.`;
    rec.add({ kind: "note", title: reasoning });
    return {
      model: "rule",
      doubleCheck: null,
      verdict: {
        score: criterion.scale === "score" ? 0 : null,
        passed: criterion.scale === "pass_fail" ? false : null,
        confidence: 1,
        reasoning,
        evidence: [{ source: "submission", detail: `${names}: empty` }],
        feedback: `Fill in ${names} so this can be judged.`,
        flags: [{ kind: "missing_input", note: `${names} missing` }],
        needsHumanReview: criterion.gate,
        reviewReason: criterion.gate ? "A gate failed only because the input is missing." : "",
      },
    };
  }

  const collected = await collectEvidence({ criterion, mechanisms, inputs, tier, guidance, resources: env.resources, rec, signal });
  const totalWeight = env.criteria.filter((c) => !judgesOnly(c)).reduce((n, c) => n + c.weight, 0);
  const input: JudgeInput = {
    hackathon: env.hackathon,
    criterion,
    weightShare: totalWeight ? Math.round((criterion.weight / totalWeight) * 100) : 0,
    guidance,
    submission: submissionText(inputs, env.project.values, projectHeadline(env.project, env.blocks)),
    sections: collected.sections,
    missing: inputs.missing.map((b) => b.title),
    findings: null,
  };

  if (TOOL_BUDGET[tier] > 0) {
    const { tools, notes } = investigationTools({ collected, mechanisms, tier, budget: TOOL_BUDGET[tier], rec, signal });
    if (Object.keys(tools).length) {
      try {
        input.findings = await investigate(input, tier, tools, notes, rec, signal);
      } catch (e) {
        // The evidence alone is still enough to judge on.
        rec.add({ kind: "error", title: "The investigation stopped early", detail: message(e), ok: false });
      }
    }
  }

  const first = await judgeVerdict(input, tier, rec, signal);
  let verdict = mergeFlags(first.verdict, collected.flags);
  let model = first.model;
  let check: DoubleCheckResult | null = null;

  if (wantsDoubleCheck(criterion, verdict)) {
    const checkWith = checkTier(tier);
    try {
      const second = await doubleCheck(input, { verdict, model }, checkWith, rec, signal);
      const agreed = verdictsAgree(verdict, second.verdict);
      check = {
        model: second.model,
        tier: checkWith,
        agreed,
        score: second.verdict.score,
        passed: second.verdict.passed,
        confidence: second.verdict.confidence,
        reasoning: !agreed && second.disagreement ? `${second.disagreement}\n\n${second.verdict.reasoning}` : second.verdict.reasoning,
      };
      if (agreed) {
        verdict = {
          ...verdict,
          confidence: Math.max(verdict.confidence, second.verdict.confidence),
          needsHumanReview: second.verdict.needsHumanReview,
          reviewReason: second.verdict.needsHumanReview ? second.verdict.reviewReason : "",
          flags: dedupe([...verdict.flags, ...second.verdict.flags]),
        };
      } else {
        // The larger model's verdict stands, and a person settles it.
        check.first = { model, score: verdict.score, passed: verdict.passed, confidence: verdict.confidence, reasoning: verdict.reasoning };
        verdict = {
          ...second.verdict,
          flags: dedupe([...verdict.flags, ...second.verdict.flags]),
          needsHumanReview: true,
          reviewReason: `The double check disagreed: ${model} said ${verdictLabel(check.first)}, ${second.model} said ${verdictLabel(second.verdict)}. ${second.disagreement}`.trim(),
        };
        model = second.model;
      }
    } catch (e) {
      rec.add({ kind: "error", title: "The double check failed", detail: message(e), ok: false });
    }
  }

  // A failed gate always gets a person's eyes before it rules a project out.
  if (criterion.gate && verdict.passed === false && !verdict.needsHumanReview) {
    verdict = { ...verdict, needsHumanReview: true, reviewReason: "This gate failed, which rules the project out. Confirm before it counts." };
  }
  return { verdict, model, doubleCheck: check };
}

const dedupe = (flags: Flag[]) => flags.filter((f, i) => flags.findIndex((g) => g.kind === f.kind && g.note === f.note) === i).slice(0, 8);

/** Flags found while collecting evidence count even if the model didn't raise them. */
function mergeFlags(v: Verdict, found: Flag[]): Verdict {
  const flags = dedupe([...v.flags, ...found]);
  return { ...v, flags };
}

// ── The write-up ──────────────────────────────────────────────────────────

async function writeUpReview(env: ReviewEnv, tier: ModelTier = "balanced") {
  const { data } = await env.supabase
    .from("agent_review_steps")
    .select("criterion_id, status, score, passed, reasoning, feedback, needs_review, override_score, override_passed")
    .eq("project_id", env.project.id)
    .returns<
      {
        criterion_id: string;
        status: string;
        score: number | null;
        passed: boolean | null;
        reasoning: string;
        feedback: string;
        needs_review: boolean;
        override_score: number | null;
        override_passed: boolean | null;
      }[]
    >();
  const steps = (data ?? [])
    .filter((s) => s.status === "done")
    .map((s) => {
      const c = env.criteria.find((x) => x.id === s.criterion_id);
      return {
        title: c?.title ?? "Criterion",
        verdict: verdictLabel({ score: s.override_score ?? s.score, passed: s.override_passed ?? s.passed }),
        reasoning: s.reasoning,
        feedback: s.feedback,
        flagged: s.needs_review,
      };
    });
  if (steps.length === 0) {
    return { summary: "The agent couldn't score any criteria for this project. See the steps below for why.", strengths: [], improvements: [] };
  }
  const { name, pitch } = projectHeadline(env.project, env.blocks);
  try {
    return await summarize(env.hackathon.name, `${formatNumber(env.project.number)} ${name}${pitch ? ` — ${pitch}` : ""}`, steps, tier);
  } catch (e) {
    console.error("[agent] couldn't write the summary:", message(e));
    return { summary: "", strengths: [], improvements: [] };
  }
}

