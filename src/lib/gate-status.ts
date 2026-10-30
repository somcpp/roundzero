import type { DistributionSettings } from "@/lib/data";

// What judges' failed gates amount to. Pure, so client components can use it;
// lib/gates.ts reads the verdicts from the database.

/** A gate criterion that at least one submitted review failed. */
export type GateFail = { criterionId: string; title: string; fails: number; reviews: number };

export type GateRule = Pick<DistributionSettings, "judgeGate" | "judgeGateCount">;

/** A project's failed gates, and whether they rule it out under the hackathon's rule. */
export type GateStatus = { fails: GateFail[]; ruledOut: boolean };

/** What a project's failed gates amount to, or null when no review failed one. */
export function gateStatus(fails: GateFail[] | undefined, rule: GateRule): GateStatus | null {
  if (!fails?.length) return null;
  return { fails, ruledOut: rule.judgeGate === "rule_out" && fails.some((f) => f.fails >= rule.judgeGateCount) };
}

/** "Working demo failed in 2 of 3 reviews", one clause per gate. */
export const describeGateFails = (fails: GateFail[]) =>
  fails.map((f) => `${f.title} failed in ${f.fails} of ${f.reviews} ${f.reviews === 1 ? "review" : "reviews"}`).join(" · ");
