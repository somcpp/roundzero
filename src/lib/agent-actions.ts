"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runAgentWorker, runSingleStep } from "@/lib/agent/run";
import type { ModelTier } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { createClient } from "@/lib/supabase/server";

// Directing the agent. Runs happen after the response (the page polls for
// progress), as the signed-in admin, so RLS applies to everything they touch.

export type AgentActionResult = { error: string } | { ok: true; queued?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS = new Set<string>(["quick", "balanced", "deep"]);
const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

type RunOptions = { guidance?: string; tier?: ModelTier | null };

function cleanRun(opts: RunOptions): { error: string } | { guidance: string; tier: ModelTier | null } {
  const guidance = String(opts.guidance ?? "").trim();
  if (guidance.length > 4000) return { error: "Keep the guidance under 4000 characters." };
  const tier = opts.tier ?? null;
  if (tier !== null && !TIERS.has(tier)) return { error: "Unknown model." };
  return { guidance, tier };
}

async function owned(slug: string) {
  const hackathon = await getHackathon(slug);
  return hackathon ? { hackathon, supabase: await createClient() } : null;
}

/** Queue the agent for these projects with the admin's direction, and start on the queue. */
export async function runAgentReviews(slug: string, projectIds: string[], opts: RunOptions = {}): Promise<AgentActionResult> {
  if (projectIds.length === 0) return { error: "Pick at least one project." };
  if (projectIds.length > 1000 || !projectIds.every((id) => UUID.test(id))) return { error: "Invalid project id. Reload and try again." };
  const run = cleanRun(opts);
  if ("error" in run) return run;
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;

  const { data, error } = await ctx.supabase.rpc("queue_agent_reviews", {
    p_hackathon_id: ctx.hackathon.id,
    p_project_ids: projectIds,
    p_guidance: run.guidance,
    p_model_tier: run.tier,
  });
  if (error) return { error: error.message };
  after(() => runAgentWorker(ctx.hackathon.id));
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true, queued: Number(data) };
}

/**
 * Review every project still in the running that the agent hasn't reviewed
 * (or failed on), and pick up anything already waiting in the queue.
 */
export async function runAgentOnUnreviewed(slug: string, opts: RunOptions = {}): Promise<AgentActionResult> {
  const run = cleanRun(opts);
  if ("error" in run) return run;
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;

  const { data: projects, error } = await ctx.supabase
    .from("projects")
    .select("id, agent_reviews(status)")
    .eq("hackathon_id", ctx.hackathon.id)
    .eq("status", "active")
    .returns<{ id: string; agent_reviews: { status: string } | { status: string }[] | null }[]>();
  if (error) return { error: error.message };
  const ids = projects
    .filter((p) => {
      const review = Array.isArray(p.agent_reviews) ? p.agent_reviews[0] : p.agent_reviews;
      return !review || review.status === "failed";
    })
    .map((p) => p.id);

  let queued = 0;
  if (ids.length) {
    const { data, error: queueError } = await ctx.supabase.rpc("queue_agent_reviews", {
      p_hackathon_id: ctx.hackathon.id,
      p_project_ids: ids,
      p_guidance: run.guidance,
      p_model_tier: run.tier,
    });
    if (queueError) return { error: queueError.message };
    queued = Number(data);
  }
  after(() => runAgentWorker(ctx.hackathon.id));
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true, queued };
}

/** True when the step belongs to one of this hackathon's projects. */
async function stepInHackathon(ctx: NonNullable<Awaited<ReturnType<typeof owned>>>, stepId: string) {
  const { data } = await ctx.supabase
    .from("agent_review_steps")
    .select("id, agent_reviews!inner(projects!inner(hackathon_id))")
    .eq("id", stepId)
    .eq("agent_reviews.projects.hackathon_id", ctx.hackathon.id)
    .maybeSingle();
  return Boolean(data);
}

/** Run one criterion again for a project, with the admin's direction for this project. */
export async function rerunAgentStep(
  slug: string,
  projectId: string,
  criterionId: string,
  opts: RunOptions = {},
): Promise<AgentActionResult> {
  if (!UUID.test(projectId) || !UUID.test(criterionId)) return { error: "Invalid id. Reload and try again." };
  const run = cleanRun(opts);
  if ("error" in run) return run;
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("hackathon_id", ctx.hackathon.id)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: stepId, error } = await ctx.supabase.rpc("queue_agent_step", {
    p_project_id: projectId,
    p_criterion_id: criterionId,
    p_guidance: run.guidance,
    p_model_tier: run.tier,
  });
  if (error) return { error: error.message };
  after(() => runSingleStep(ctx.hackathon.id, projectId, stepId as string));
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

/** Put an admin's verdict in place of the agent's (a 0–10 score or pass/fail), or clear it with null. */
export async function overrideAgentStep(
  slug: string,
  stepId: string,
  value: number | boolean | null,
  note: string,
): Promise<AgentActionResult> {
  if (!UUID.test(stepId)) return { error: "Invalid id. Reload and try again." };
  if (typeof value === "number" && !(Number.isInteger(value) && value >= 0 && value <= 10)) {
    return { error: "Scores are whole numbers from 0 to 10." };
  }
  if (value !== null && typeof value !== "number" && typeof value !== "boolean") return { error: "Unknown value." };
  const reason = String(note ?? "").trim();
  if (reason.length > 4000) return { error: "Keep the reason under 4000 characters." };
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  if (!(await stepInHackathon(ctx, stepId))) return { error: "Step not found." };

  const { error } = await ctx.supabase.rpc("override_agent_step", {
    p_step_id: stepId,
    p_score: typeof value === "number" ? value : null,
    p_passed: typeof value === "boolean" ? value : null,
    p_note: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

/** Flag a step for a person (with what to look at), or clear the flag once someone has. */
export async function flagAgentStep(slug: string, stepId: string, flagged: boolean, note: string): Promise<AgentActionResult> {
  if (!UUID.test(stepId)) return { error: "Invalid id. Reload and try again." };
  const reason = String(note ?? "").trim();
  if (reason.length > 2000) return { error: "Keep the note under 2000 characters." };
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  if (!(await stepInHackathon(ctx, stepId))) return { error: "Step not found." };

  const { error } = await ctx.supabase.rpc("flag_agent_step", { p_step_id: stepId, p_flag: Boolean(flagged), p_note: reason });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}
