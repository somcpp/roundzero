import { getRun, start } from "workflow/api";
import { buildAgentInboxEmail } from "@/lib/email/agent-inbox";
import { emailConfig } from "@/lib/email/config";
import { adminDb } from "@/lib/email/deliver";
import { agentInboxEmail } from "@/workflows/agent-inbox";
import { announceResults } from "@/workflows/announce";
import type { Announcement } from "@/workflows/announce/steps";
import { advancedToken, completeToken, phaseAdvanced, phaseComplete, type PhaseRun } from "@/workflows/hooks";
import { emailJudgeLink } from "@/workflows/judge-link";
import { judgingPhaseEmails } from "@/workflows/judging-phase";

// Starts, signals and cancels the email workflows (src/workflows/*) for the
// server actions. Callers have already checked the signed-in owner owns the
// hackathon; the reads here use the secret key so they also work from after().
// Everything is best effort: an email problem never fails the click it hangs off.

type RunKind = "phase" | "winners" | "thank_you";

const quietly = async (what: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    console.error(`[email] ${what}:`, e instanceof Error ? e.message : e);
  }
};

/** The hackathon's running phase as a workflow input, or null. */
export async function runningPhase(hackathonId: string): Promise<PhaseRun | null> {
  const { data, error } = await adminDb()
    .from("judging_phases")
    .select("id, started_at")
    .eq("hackathon_id", hackathonId)
    .not("started_at", "is", null)
    .is("closed_at", null)
    .order("position")
    .limit(1)
    .maybeSingle<{ id: string; started_at: string }>();
  if (error) throw new Error(`Couldn't load the running phase: ${error.message}`);
  return data && { hackathonId, phaseId: data.id, startedAt: data.started_at };
}

async function record(runId: string, hackathonId: string, kind: RunKind, phaseId: string | null = null) {
  const { error } = await adminDb().from("email_runs").insert({ run_id: runId, hackathon_id: hackathonId, kind, phase_id: phaseId });
  if (error) throw new Error(`Couldn't record the email run: ${error.message}`);
}

/** Start the running phase's emails (judge links, batches, owner notices), once per phase start. */
export function startPhaseEmails(hackathonId: string) {
  return quietly("starting phase emails", async () => {
    if ("missing" in emailConfig()) return;
    const run = await runningPhase(hackathonId);
    if (!run) return;
    const { count } = await adminDb()
      .from("email_runs")
      .select("run_id", { count: "exact", head: true })
      .eq("phase_id", run.phaseId)
      .eq("kind", "phase")
      .gte("created_at", run.startedAt);
    if (count) return;
    const started = await start(judgingPhaseEmails, [run]);
    await record(started.runId, hackathonId, "phase", run.phaseId);
  });
}

/** Tell the phase's run it's closed, so it stops waiting and reminding. */
export function signalPhaseAdvanced(run: PhaseRun) {
  return quietly("signalling phase closed", () => phaseAdvanced.resume(advancedToken(run), { at: new Date().toISOString() }));
}

/** If every judge review in the running phase is in, tell its run (which emails the owner). */
export function signalIfPhaseComplete(hackathonId: string) {
  return quietly("checking phase progress", async () => {
    const run = await runningPhase(hackathonId);
    if (!run) return;
    const db = adminDb();
    const all = () =>
      db.from("judge_assignments").select("id", { count: "exact", head: true }).eq("phase_id", run.phaseId).not("judge_id", "is", null);
    const [total, open] = await Promise.all([all(), all().is("submitted_at", null)]);
    if (!total.count || open.count) return;
    await phaseComplete.resume(completeToken(run), { at: new Date().toISOString() });
  });
}

/** The same, starting from a judge assignment (a judge scoring from their link). */
export function signalIfPhaseCompleteFor(assignmentId: string) {
  return quietly("checking phase progress", async () => {
    const { data } = await adminDb()
      .from("judge_assignments")
      .select("judging_phases(hackathon_id)")
      .eq("id", assignmentId)
      .maybeSingle<{ judging_phases: { hackathon_id: string } | null }>();
    if (data?.judging_phases) await signalIfPhaseComplete(data.judging_phases.hackathon_id);
  });
}

/**
 * Email the owner the agent's gate failures waiting on a call, once per new
 * failure. Reads as the signed-in owner (src/lib/email/agent-inbox.ts), so
 * call it from their server action or its after().
 */
export function startAgentInboxEmail(hackathonId: string) {
  return quietly("emailing the agent-failed inbox", async () => {
    if ("missing" in emailConfig()) return;
    const send = await buildAgentInboxEmail(hackathonId);
    if (send) await start(agentInboxEmail, [send]);
  });
}

/** Stop every email run for the hackathon that's still waiting, e.g. on "Reset judging". */
export function cancelEmailRuns(hackathonId: string, kinds: RunKind[] = ["phase"]) {
  return quietly("cancelling email runs", async () => {
    const db = adminDb();
    const { data } = await db.from("email_runs").select("run_id").eq("hackathon_id", hackathonId).in("kind", kinds);
    for (const { run_id } of data ?? []) {
      await quietly(`cancelling run ${run_id}`, async () => {
        const run = getRun(run_id);
        if (["pending", "running"].includes(await run.status)) await run.cancel();
      });
    }
    await db.from("email_runs").delete().eq("hackathon_id", hackathonId).in("kind", kinds);
  });
}

/** Email one judge their link for the running phase again. Throws if it can't start. */
export async function startJudgeLink(hackathonId: string, judgeId: string) {
  const config = emailConfig();
  if ("missing" in config) throw new Error(`Email isn't set up on this server: ${config.missing}.`);
  const run = await runningPhase(hackathonId);
  if (!run) throw new Error("There's no phase running, so there's no queue to send.");
  await start(emailJudgeLink, [run, judgeId, new Date().toISOString()]);
}

/** Send a results announcement (winners, or everyone else). Throws if it can't start. */
export async function startAnnouncement(a: Announcement) {
  const config = emailConfig();
  if ("missing" in config) throw new Error(`Email isn't set up on this server: ${config.missing}.`);
  const started = await start(announceResults, [a]);
  await record(started.runId, a.hackathonId, a.kind === "winner" ? "winners" : "thank_you");
}
