import { sleep } from "workflow";
import { advancedToken, completeToken, phaseAdvanced, phaseComplete, type PhaseRun } from "@/workflows/hooks";
import { checkPhase, emailJudges, notifyOwner, phaseJudges, planPhase } from "./steps";

// The emails around one judging phase, from the moment it starts until the
// owner closes it (started by src/lib/email/runs.ts):
//
//   start ─ judges get their links (invite)
//   daily batches ─ each morning's batch: judges with new projects get a nudge
//   due date ─ judges still behind get a last call; the owner hears it's due
//   every review in ─ the owner gets "phase done", then a reminder every
//                     2 days (3 at most) until they close the phase
//
// Nothing here moves projects: closing a phase is always the owner's click on
// the progress page, which resumes `phaseAdvanced` so this run ends, and
// starts the next phase's run.

const REMINDERS = 3;

type Signal = "complete" | "advanced";

export async function judgingPhaseEmails(run: PhaseRun) {
  "use workflow";
  // Each `then` on a hook waits for its *next* payload, so take one promise
  // per hook and race that same promise every time.
  const completed: Promise<Signal> = phaseComplete.create({ token: completeToken(run) }).then(() => "complete");
  const advanced: Promise<Signal> = phaseAdvanced.create({ token: advancedToken(run) }).then(() => "advanced");
  const until = (at: string | Date) => sleep(at instanceof Date ? at : new Date(at)).then(() => null);

  /** Email every judge in the phase, chunk by chunk. False if the phase moved on. */
  const toJudges = async (kind: "invite" | "batch" | "last call", day: number) => {
    const chunks = await phaseJudges(run);
    if (!chunks) return false;
    for (const ids of chunks) {
      if (!(await emailJudges(run, kind, day, ids))) return false;
    }
    return true;
  };

  const plan = await planPhase(run);
  if (!plan || !(await toJudges("invite", 0))) return "stale";

  let signal: Signal | null = plan.complete ? "complete" : null;
  for (const [i, opensAt] of plan.batchOpens.entries()) {
    if (signal) break;
    signal = await Promise.race([completed, advanced, until(opensAt)]);
    if (!signal && !(await toJudges("batch", i + 1))) return "stale";
  }

  if (!signal && plan.dueAt) {
    signal = await Promise.race([completed, advanced, until(plan.dueAt)]);
    if (!signal) {
      // A score may have landed without the signal reaching us; check before nagging.
      const state = await checkPhase(run);
      if (state === "stale") return "stale";
      if (state === "complete") signal = "complete";
      else {
        if (!(await toJudges("last call", 0))) return "stale";
        if ((await notifyOwner(run, "due", 0)) === "stale") return "stale";
      }
    }
  }

  // Wait for the last review. A daily look at the counts covers any score
  // path that didn't send the signal.
  while (!signal) {
    signal = await Promise.race([completed, advanced, sleep("1d").then(() => null)]);
    if (!signal) {
      const state = await checkPhase(run);
      if (state === "stale") return "stale";
      if (state === "complete") signal = "complete";
    }
  }
  if (signal === "advanced") return "advanced";

  for (let reminder = 0; reminder <= REMINDERS; reminder++) {
    if ((await notifyOwner(run, "done", reminder)) === "stale") return "stale";
    if (reminder < REMINDERS && (await Promise.race([advanced, sleep("2d").then(() => null)]))) return "advanced";
  }
  return "reminded";
}
