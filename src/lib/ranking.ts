/** What a project is ranked on within a phase. */
export type RankInput = { number: number; avg: number | null; agentTotal: number | null; gateFailed: boolean };

/**
 * The order public.rank_phase ranks a phase in: gate passes first, then
 * average judge score, then agent score, then submission order.
 */
export const compareRank = (a: RankInput, b: RankInput) =>
  Number(a.gateFailed) - Number(b.gateFailed) ||
  (b.avg ?? -1) - (a.avg ?? -1) ||
  (b.agentTotal ?? -1) - (a.agentTotal ?? -1) ||
  a.number - b.number;

export const average = (xs: number[]) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : null);
