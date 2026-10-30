import { defineHook } from "workflow";

// Signals into a running phase workflow (./judging-phase), resumed by server
// code when something happens in the app. Tokens are per phase *start*, so a
// phase started again after "Reset judging" gets a fresh run and fresh hooks.

/** Every judge review in the phase is in. */
export const phaseComplete = defineHook<{ at: string }>();

/** The owner closed the phase, so its emails can stop. */
export const phaseAdvanced = defineHook<{ at: string }>();

export type PhaseRun = { hackathonId: string; phaseId: string; startedAt: string };

export const phaseKey = ({ phaseId, startedAt }: Pick<PhaseRun, "phaseId" | "startedAt">) =>
  `${phaseId}:${Date.parse(startedAt)}`;

export const completeToken = (run: Pick<PhaseRun, "phaseId" | "startedAt">) => `phase-complete:${phaseKey(run)}`;
export const advancedToken = (run: Pick<PhaseRun, "phaseId" | "startedAt">) => `phase-advanced:${phaseKey(run)}`;
