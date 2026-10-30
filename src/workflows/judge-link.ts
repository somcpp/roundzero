import type { PhaseRun } from "@/workflows/hooks";
import { emailJudges } from "@/workflows/judging-phase/steps";

// The owner's "Email link" button on a judge: their invite for the running
// phase, sent again now. `requestedAt` keys it, so each click is one email.

export async function emailJudgeLink(run: PhaseRun, judgeId: string, requestedAt: string) {
  "use workflow";
  return emailJudges(run, "invite", 0, [judgeId], requestedAt);
}
