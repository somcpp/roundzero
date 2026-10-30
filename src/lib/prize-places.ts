import type { ProjectValue } from "@/lib/data";

// Which rank tiers each place in a ranking collects, and the "one prize per
// team" rule behind it. Pure, so the results page, a project's page and the
// public winners page all place prizes the same way.

/** A team member as matched across projects: trimmed, lowercased, single-spaced. */
const member = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Which entrant each project belongs to, as project id → entrant key.
 * Projects are the same entrant when they share a member in any of
 * `teamBlockIds`, directly or through others (A shares with B, B with C).
 * A project without members is its own entrant.
 */
export function entrantsOf(
  projects: { id: string; values: Record<string, ProjectValue> }[],
  teamBlockIds: string[],
): Map<string, string> {
  // Union-find over project ids.
  const parent = new Map(projects.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    const up = parent.get(id)!;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  const firstWith = new Map<string, string>();
  for (const p of projects) {
    for (const blockId of teamBlockIds) {
      const v = p.values[blockId];
      for (const name of Array.isArray(v) ? v : typeof v === "string" ? [v] : []) {
        const m = member(name);
        if (!m) continue;
        const other = firstWith.get(m);
        if (other === undefined) firstWith.set(m, p.id);
        else parent.set(find(p.id), find(other));
      }
    }
  }
  return new Map(projects.map((p) => [p.id, find(p.id)]));
}

export type Placement<T> = {
  /** The place rank tiers match on: the rank itself, or with one prize per entrant, the place among projects not skipped. */
  prizePlace: number | null;
  /** The better-ranked project of the same entrant that took its prize, when this one was skipped. */
  blockedBy: string | null;
  /** Rank tiers this place collects. */
  tiers: T[];
};

/**
 * The rank tiers each project in a ranking collects. Normally a project's
 * rank picks its tiers. With `entrants` (one prize per entrant), the ranking
 * is walked best first: a project whose entrant already won a rank prize with
 * a better-ranked project is skipped and gets nothing, and every project below
 * moves up a place for each one skipped above it.
 */
export function placeRanking<T>(
  ranking: { id: string; rank: number }[],
  tiersAt: (place: number) => T[],
  entrants: Map<string, string> | null,
): Map<string, Placement<T>> {
  const placed = new Map<string, Placement<T>>();
  if (!entrants) {
    for (const r of ranking) placed.set(r.id, { prizePlace: r.rank, blockedBy: null, tiers: tiersAt(r.rank) });
    return placed;
  }
  const wonBy = new Map<string, string>();
  let skipped = 0;
  for (const r of [...ranking].sort((a, b) => a.rank - b.rank)) {
    const entrant = entrants.get(r.id) ?? r.id;
    const winner = wonBy.get(entrant);
    if (winner) {
      skipped++;
      placed.set(r.id, { prizePlace: null, blockedBy: winner, tiers: [] });
      continue;
    }
    const place = r.rank - skipped;
    const tiers = tiersAt(place);
    if (tiers.length) wonBy.set(entrant, r.id);
    placed.set(r.id, { prizePlace: place, blockedBy: null, tiers });
  }
  return placed;
}
