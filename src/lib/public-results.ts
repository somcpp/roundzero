import { cache } from "react";
import type { BlockType, ProjectValue, RewardKind } from "@/lib/data";
import { formatDates, initials } from "@/lib/format-hackathon";
import { hackathonLogoUrl } from "@/lib/hackathon-logos";
import { entrantsOf, placeRanking } from "@/lib/prize-places";
import { valueText } from "@/lib/project-fields";
import { createClient } from "@/lib/supabase/server";

/** Postgres and PostgREST codes for a function that doesn't exist (yet). */
const MISSING_FUNCTION = new Set(["42883", "PGRST202"]);

// Reads public.public_results() (migrations/*_public_results_and_mixed_split.sql)
// for the winners page. It works signed out, returning published results only,
// plus a preview for the hackathon's owner.

type RawResults = {
  hackathon: {
    slug: string;
    name: string;
    tagline: string;
    starts_on: string | null;
    ends_on: string | null;
    color: string;
    logo: string | null;
    logo_path: string | null;
    published: boolean;
  };
  counts: { projects: number; judges: number };
  blocks: { id: string; title: string; type: BlockType; role: "name" | "pitch" | null }[];
  projects: { id: string; number: number; final_rank: number | null; values: Record<string, ProjectValue> }[];
  tiers: {
    id: string;
    name: string;
    description: string;
    recipients: "ranks" | "award";
    rank_from: number | null;
    rank_to: number | null;
    image_path: string | null;
    items: { kind: RewardKind; label: string }[];
  }[];
  awards: { tier_id: string; project_id: string }[];
};

export type PublicTier = {
  id: string;
  name: string;
  description: string;
  imagePath: string | null;
  items: { kind: RewardKind; label: string }[];
};

export type PublicProject = {
  id: string;
  number: number;
  /** Final rank, or null for award-only winners. */
  rank: number | null;
  name: string;
  pitch: string;
  team: string[];
  repo: string | null;
  demo: string | null;
  video: string | null;
  /** Every tier it collects: rank tiers by its place, then awards. */
  tiers: PublicTier[];
};

export type PublicResults = {
  hackathon: {
    slug: string;
    name: string;
    tagline: string;
    dates: string;
    color: string;
    logo: string;
    logoUrl: string | null;
    published: boolean;
  };
  counts: { projects: number; judges: number };
  /** Ranked finalists, best first. Empty until the last phase closes. */
  finalists: PublicProject[];
  /** Awards that have at least one winner, in reward order. */
  awards: { tier: PublicTier; winners: PublicProject[] }[];
};

/** Entrants type these links, so only plain web links are shown. */
function webLink(v: ProjectValue | undefined) {
  const s = valueText(v);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** A hackathon's published results for /w/[slug], or null if there's nothing public to show. */
export const getPublicResults = cache(async (slug: string): Promise<PublicResults | null> => {
  const supabase = await createClient();
  const [{ data, error }, rules] = await Promise.all([
    supabase.rpc("public_results", { p_slug: slug }),
    supabase.rpc("public_reward_settings", { p_slug: slug }),
  ]);
  if (error) throw new Error(`Couldn't load the results: ${error.message}`);
  // public_reward_settings() comes with the reward_settings migration; until
  // that's applied there's no rule to follow.
  if (rules.error && !MISSING_FUNCTION.has(rules.error.code)) {
    throw new Error(`Couldn't load the reward settings: ${rules.error.message}`);
  }
  if (!data) return null;
  const raw = data as RawResults;
  const oneWinPerEntrant = (rules.data as { one_win_per_entrant?: boolean } | null)?.one_win_per_entrant === true;

  const block = (role: "name" | "pitch") => raw.blocks.find((b) => b.role === role)?.id;
  const first = (type: BlockType) => raw.blocks.find((b) => b.type === type)?.id;
  const [nameId, pitchId, teamId, repoId, demoId, videoId] = [
    block("name"),
    block("pitch"),
    first("team"),
    first("repo url"),
    first("url"),
    first("video url"),
  ];

  const toTier = (t: RawResults["tiers"][number]): PublicTier => ({
    id: t.id,
    name: t.name,
    description: t.description,
    imagePath: t.image_path,
    items: t.items,
  });
  const rankTiers = raw.tiers.filter((t) => t.recipients === "ranks");
  const awardTiers = raw.tiers.filter((t) => t.recipients === "award");

  // Rank tiers by place, the way lib/results.ts places them, including one prize per team.
  const teamIds = raw.blocks.filter((b) => b.type === "team").map((b) => b.id);
  const placed = placeRanking(
    raw.projects.filter((p) => p.final_rank !== null).map((p) => ({ id: p.id, rank: p.final_rank! })),
    (place) => rankTiers.filter((t) => t.rank_from !== null && t.rank_to !== null && t.rank_from <= place && place <= t.rank_to),
    oneWinPerEntrant ? entrantsOf(raw.projects, teamIds) : null,
  );

  const projects = new Map(
    raw.projects.map((p) => {
      const at = (id: string | undefined) => (id ? p.values[id] : undefined);
      const team = at(teamId);
      const rank = p.final_rank;
      const tiers = [
        ...(placed.get(p.id)?.tiers ?? []),
        ...awardTiers.filter((t) => raw.awards.some((a) => a.tier_id === t.id && a.project_id === p.id)),
      ].map(toTier);
      const project: PublicProject = {
        id: p.id,
        number: p.number,
        rank,
        name: valueText(at(nameId)) || `Project #${String(p.number).padStart(3, "0")}`,
        pitch: valueText(at(pitchId)),
        team: Array.isArray(team) ? team : [],
        repo: webLink(at(repoId)),
        demo: webLink(at(demoId)),
        video: webLink(at(videoId)),
        tiers,
      };
      return [p.id, project];
    }),
  );

  const h = raw.hackathon;
  return {
    hackathon: {
      slug: h.slug,
      name: h.name,
      tagline: h.tagline,
      dates: formatDates(h.starts_on, h.ends_on),
      color: h.color,
      logo: h.logo || initials(h.name) || "?",
      logoUrl: hackathonLogoUrl(h.logo_path),
      published: h.published,
    },
    counts: raw.counts,
    finalists: [...projects.values()].filter((p) => p.rank !== null).sort((a, b) => a.rank! - b.rank!),
    awards: awardTiers
      .map((t) => ({
        tier: toTier(t),
        winners: raw.awards
          .filter((a) => a.tier_id === t.id)
          .map((a) => projects.get(a.project_id))
          .filter((p): p is PublicProject => !!p),
      }))
      .filter((a) => a.winners.length > 0),
  };
});
