"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type {
  DistributionSettings,
  JudgingPhase,
  ProjectStatus,
  ProjectValue,
} from "@/lib/data";
import { runAgentWorker } from "@/lib/agent/run";
import { cancelEmailRuns, runningPhase, signalIfPhaseComplete, signalPhaseAdvanced, startPhaseEmails } from "@/lib/email/runs";
import type { PhaseRun } from "@/workflows/hooks";
import { getHackathon } from "@/lib/hackathons";
import { listPhases } from "@/lib/judging";
import { HEX_COLOR } from "@/lib/phase-colors";
import { normalizeContactEmail } from "@/lib/intake-shape";
import { normalizeValues } from "@/lib/project-fields";
import { indexProjectQuietly } from "@/lib/project-index";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown) => String(v ?? "").trim();
const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

async function owned(slug: string) {
  const hackathon = await getHackathon(slug);
  return hackathon ? { hackathon, supabase: await createClient() } : null;
}

// ── Phases ────────────────────────────────────────────────────────────────

export type SavePhasesResult = { error: string } | { items: JudgingPhase[] };

/** Replace the hackathon's judging phases with `phases`, in order. */
export async function savePhases(slug: string, phases: JudgingPhase[]): Promise<SavePhasesResult> {
  if (phases.length === 0) return { error: "Keep at least one phase." };
  if (phases.length > 10) return { error: "Ten phases is the most." };
  const rows = [];
  let pool = Infinity;
  for (const [i, p] of phases.entries()) {
    const name = text(p.name);
    if (!name) return { error: "Every phase needs a name." };
    if (name.length > 60) return { error: `Keep "${name.slice(0, 24)}…" under 60 characters.` };
    if (!UUID.test(p.id) || (p.judgeGroupId !== null && !UUID.test(p.judgeGroupId))) {
      return { error: "A phase has an invalid id. Reload and try again." };
    }
    const reviews = p.reviewsPerProject === null ? null : Math.round(Number(p.reviewsPerProject));
    if (reviews !== null && !(reviews >= 1 && reviews <= 20)) return { error: `Reviews per project on "${name}" must be 1–20.` };
    // The last phase picks winners, so nothing advances from it.
    const last = i === phases.length - 1;
    const advance = last || p.advanceCount === null ? null : Math.round(Number(p.advanceCount));
    if (!last && advance === null) return { error: `Say how many projects advance from "${name}".` };
    if (advance !== null) {
      if (!(advance >= 1 && advance <= 10000)) return { error: `Projects advancing from "${name}" must be 1–10,000.` };
      if (advance >= pool) return { error: `"${name}" should advance fewer projects than the phase before it.` };
      pool = advance;
    }
    const color = p.color || null;
    if (color !== null && !HEX_COLOR.test(color)) return { error: `The color on "${name}" should be a hex like #7c3aed.` };
    rows.push({ id: p.id, name, judge_group_id: p.judgeGroupId, reviews_per_project: reviews, advance_count: advance, color });
  }

  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  // Once judging starts only names can change: the same phases, in the same
  // order, with the judges, reviews and advance counts they started with.
  if (ctx.hackathon.judgingStartedAt) {
    const saved = await listPhases(ctx.hackathon.id);
    const shape = JSON.stringify(rows.map((r) => [r.id, r.judge_group_id, r.reviews_per_project, r.advance_count]));
    if (shape !== JSON.stringify(saved.map((s) => [s.id, s.judgeGroupId, s.reviewsPerProject, s.advanceCount]))) {
      return { error: "Judging has started, so only phase names and colors can change. Reset judging to change the rest." };
    }
  }
  const { error } = await ctx.supabase.rpc("save_judging_phases", { p_hackathon_id: ctx.hackathon.id, p_phases: rows });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { items: await listPhases(ctx.hackathon.id) };
}

// ── Distribution ──────────────────────────────────────────────────────────

export type SaveDistributionResult = { error: string } | { settings: DistributionSettings };

export async function saveDistribution(slug: string, s: DistributionSettings): Promise<SaveDistributionResult> {
  if (s.strategy !== "even" && s.strategy !== "mixed") return { error: "Unknown strategy." };
  if (s.cadence !== "once" && s.cadence !== "daily") return { error: "Unknown cadence." };
  const batchDays = Math.round(Number(s.batchDays));
  if (!(batchDays >= 1 && batchDays <= 30)) return { error: "Batches can run over 1–30 days." };
  if (!["admin", "judge", "nobody"].includes(s.failedInbox)) return { error: "Pick who reviews agent-failed projects." };
  const inboxJudgeId = s.failedInbox === "judge" ? s.inboxJudgeId : null;
  if (s.failedInbox === "judge" && !inboxJudgeId) return { error: "Pick the judge who reviews agent-failed projects." };
  if (inboxJudgeId !== null && !UUID.test(inboxJudgeId)) return { error: "Invalid judge. Reload and try again." };
  if (s.judgeGate !== "flag" && s.judgeGate !== "rule_out") return { error: "Unknown rule for failed gates." };
  const judgeGateCount = Math.round(Number(s.judgeGateCount));
  if (!(judgeGateCount >= 1 && judgeGateCount <= 20)) return { error: "A gate can take 1–20 failing reviews to rule a project out." };

  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  // These decided the assignments already handed out, so they can't change mid-judging.
  if (ctx.hackathon.judgingStartedAt) return { error: "Judging has started, so distribution is locked. Reset judging to change it." };
  const settings: DistributionSettings = {
    agentFirst: Boolean(s.agentFirst),
    failedInbox: s.failedInbox,
    inboxJudgeId,
    strategy: s.strategy,
    cadence: s.cadence,
    batchDays,
    showAgentScore: Boolean(s.showAgentScore),
    judgeGate: s.judgeGate,
    judgeGateCount,
  };
  const { error } = await ctx.supabase.from("distribution_settings").upsert({
    hackathon_id: ctx.hackathon.id,
    agent_first: settings.agentFirst,
    failed_inbox: settings.failedInbox,
    inbox_judge_id: settings.inboxJudgeId,
    strategy: settings.strategy,
    cadence: settings.cadence,
    batch_days: settings.batchDays,
    show_agent_score: settings.showAgentScore,
    judge_gate: settings.judgeGate,
    judge_gate_count: settings.judgeGateCount,
  });
  if (error) {
    if (error.code === "42501") return { error: "That judge isn't in this hackathon any more. Reload and pick again." };
    return { error: error.message };
  }
  revalidatePath(`/h/${slug}`, "layout");
  return { settings };
}

// ── Projects ──────────────────────────────────────────────────────────────

export type ProjectActionResult = { error: string } | { ok: true; number?: number };

/**
 * Create or update a project. `values` maps schema block id → value; empty
 * values are dropped. `contactEmail` is the fixed contact field ("" clears it).
 */
export async function saveProject(
  slug: string,
  project: { id: string; values: Record<string, ProjectValue>; contactEmail?: string },
): Promise<ProjectActionResult> {
  if (!UUID.test(project.id)) return { error: "This project has an invalid id. Reload and try again." };
  const contact = normalizeContactEmail(project.contactEmail);
  if ("error" in contact) return contact;
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  const blocks = await listSchemaBlocks(ctx.hackathon.id);

  const normalized = normalizeValues(blocks, project.values);
  if ("error" in normalized) return normalized;
  const { values } = normalized;
  if (Object.keys(values).length === 0) return { error: "Fill in at least one field." };

  const { data, error } = await ctx.supabase.rpc("save_project", {
    p_hackathon_id: ctx.hackathon.id,
    p_project: { id: project.id, values, ...(project.contactEmail !== undefined && { contact_email: contact.email }) },
  });
  if (error) {
    if (error.code === "23505") return { error: "Another project was added at the same moment. Try again." };
    return { error: error.message };
  }
  revalidatePath(`/h/${slug}`, "layout");
  // Re-embed for the chat's project search once the response is sent.
  after(() => indexProjectQuietly(ctx.hackathon.id, project.id, { blocks }));
  return { ok: true, number: data as number };
}

export async function deleteProject(slug: string, id: string): Promise<ProjectActionResult> {
  if (!UUID.test(id)) return { error: "Invalid project id." };
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  const { error } = await ctx.supabase.from("projects").delete().eq("id", id).eq("hackathon_id", ctx.hackathon.id);
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

/** Move projects into a phase, or out of judging with `phaseId` null. */
export async function moveProjects(slug: string, ids: string[], phaseId: string | null): Promise<ProjectActionResult> {
  if (!ids.length) return { error: "Pick at least one project." };
  if (!ids.every((id) => UUID.test(id)) || (phaseId !== null && !UUID.test(phaseId))) {
    return { error: "Invalid id. Reload and try again." };
  }
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  const { error } = await ctx.supabase.rpc("move_projects", {
    p_hackathon_id: ctx.hackathon.id,
    p_project_ids: ids,
    p_phase_id: phaseId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

const STATUSES = new Set<ProjectStatus>(["active", "eliminated", "disqualified"]);

export async function setProjectStatus(
  slug: string,
  ids: string[],
  status: ProjectStatus,
  note = "",
): Promise<ProjectActionResult> {
  if (!ids.length) return { error: "Pick at least one project." };
  if (!STATUSES.has(status)) return { error: "Unknown status." };
  if (!ids.every((id) => UUID.test(id))) return { error: "Invalid id. Reload and try again." };
  const reason = text(note);
  if (reason.length > 2000) return { error: "Keep the reason under 2000 characters." };
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  const { error } = await ctx.supabase.rpc("set_project_status", {
    p_hackathon_id: ctx.hackathon.id,
    p_project_ids: ids,
    p_status: status,
    p_note: reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

/** Add a free-text note to a project's audit trail. */
export async function addProjectNote(slug: string, id: string, note: string): Promise<ProjectActionResult> {
  const body = text(note);
  if (!body) return { error: "Write something first." };
  if (body.length > 2000) return { error: "Keep notes under 2000 characters." };
  if (!UUID.test(id)) return { error: "Invalid project id." };
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  // Check the project is in this hackathon; RLS already limits it to the owner.
  const { data } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("hackathon_id", ctx.hackathon.id)
    .maybeSingle();
  if (!data) return { error: "Project not found." };
  const { error } = await ctx.supabase.from("project_events").insert({ project_id: id, kind: "note", data: { note: body } });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

// ── Judging lifecycle ─────────────────────────────────────────────────────

async function lifecycle<T = undefined>(
  slug: string,
  fn: string,
  then?: (hackathonId: string, before: T) => void,
  /** Runs before the RPC; its result goes to `then`. */
  before?: (hackathonId: string) => Promise<T>,
): Promise<ProjectActionResult> {
  const ctx = await owned(slug);
  if (!ctx) return NOT_FOUND;
  const prior = (await before?.(ctx.hackathon.id)) as T;
  const { error } = await ctx.supabase.rpc(fn, { p_hackathon_id: ctx.hackathon.id });
  if (error) return { error: error.message };
  then?.(ctx.hackathon.id, prior);
  revalidatePath(`/h/${slug}`, "layout");
  revalidatePath("/");
  return { ok: true };
}

/** Move projects into the first phase, queue agent reviews (and start on them) and email judges their links. */
export async function startJudging(slug: string) {
  return lifecycle(slug, "start_judging", (hackathonId) => {
    after(() => runAgentWorker(hackathonId));
    after(() => startPhaseEmails(hackathonId));
  });
}

/**
 * Close the running phase: advance its top projects, eliminate the rest, start
 * the next. Its email run stops, and the next phase's judges get their links.
 */
export async function closeJudgingPhase(slug: string) {
  return lifecycle<PhaseRun | null>(
    slug,
    "close_judging_phase",
    (hackathonId, closing) =>
      after(async () => {
        if (closing) await signalPhaseAdvanced(closing);
        await startPhaseEmails(hackathonId);
      }),
    // Read before closing: afterwards the running phase is the next one.
    (hackathonId) => runningPhase(hackathonId).catch(() => null),
  );
}

/** Undo judging back to setup, and stop its emails. Disqualifications and the audit trail stay. */
export async function resetJudging(slug: string) {
  return lifecycle(slug, "reset_judging", (hackathonId) => after(() => cancelEmailRuns(hackathonId)));
}

/** Demo only: finish some agent reviews and judge assignments with made-up scores. */
export async function simulateJudging(slug: string) {
  return lifecycle(slug, "simulate_judging", (hackathonId) => after(() => signalIfPhaseComplete(hackathonId)));
}
