import { cache } from "react";
import type { Hackathon, Stage } from "@/lib/data";
import { formatDates, initials } from "@/lib/format-hackathon";
import { hackathonBannerUrl } from "@/lib/hackathon-banners";
import { hackathonLogoUrl } from "@/lib/hackathon-logos";
import { createClient } from "@/lib/supabase/server";

/** A row of public.hackathons (supabase/migrations/*_create_hackathons.sql). */
export type HackathonRow = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  tagline: string;
  starts_on: string | null;
  ends_on: string | null;
  stage: Stage;
  color: string;
  logo: string | null;
  logo_path: string | null;
  banner_path: string | null;
  published: boolean;
  judging_started_at: string | null;
  judging_phases: {
    name: string;
    position: number;
    started_at: string | null;
    closed_at: string | null;
    /** Only on the list query: the phase's assignments, and how many are submitted. */
    assigned?: { count: number }[];
    done?: { count: number }[];
  }[];
  /** Only on the list query. */
  projects?: { count: number }[];
  judges?: { count: number }[];
  schema_blocks?: { count: number }[];
  criteria?: { weight: number }[];
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, owner_id, slug, name, tagline, starts_on, ends_on, stage, color, logo, logo_path, banner_path, published, judging_started_at, created_at, updated_at, judging_phases(name, position, started_at, closed_at)";

// The home page also shows each hackathon's project and judge counts, how far
// the running phase's reviews have got, and where setup is up to. `done` is
// filtered to submitted assignments in listHackathons().
const LIST_COLUMNS =
  "id, owner_id, slug, name, tagline, starts_on, ends_on, stage, color, logo, logo_path, banner_path, published, judging_started_at, created_at, updated_at, " +
  "judging_phases(name, position, started_at, closed_at, assigned:judge_assignments(count), done:judge_assignments(count)), projects(count), judges(count), " +
  "schema_blocks(count), criteria(weight)";

const count = (rows?: { count: number }[]) => rows?.[0]?.count ?? 0;

function currentPhase(row: HackathonRow): Hackathon["currentPhase"] {
  const phases = [...row.judging_phases].sort((a, b) => a.position - b.position);
  const index = phases.findIndex((p) => p.started_at && !p.closed_at);
  return index === -1 ? null : { name: phases[index].name, index, count: phases.length };
}

/** Percent of the running phase's reviews submitted; 100 once results are in. */
function progressOf(row: HackathonRow) {
  if (row.stage === "results") return 100;
  const running = row.judging_phases.find((p) => p.started_at && !p.closed_at);
  const assigned = count(running?.assigned);
  return assigned ? Math.round((count(running?.done) / assigned) * 100) : 0;
}

/**
 * Where a setup-stage hackathon is up to, for its home page card: the first
 * step left, in Setup's tab order, then projects, which judging can't start
 * without. As on the progress page's checklist, criteria are done once their
 * weights add to 100%. Undefined off the list query, which is the only one
 * with the counts.
 */
function setupProgress(row: HackathonRow) {
  if (row.stage !== "setup" || !row.criteria) return undefined;
  const steps: [string, boolean][] = [
    ["Schema", count(row.schema_blocks) > 0],
    ["Criteria", row.criteria.reduce((n, c) => n + c.weight, 0) === 100],
    ["Judges", count(row.judges) > 0],
    ["Phases", row.judging_phases.length > 0],
    ["Projects", count(row.projects) > 0],
  ];
  const next = steps.findIndex(([, done]) => !done);
  if (next === -1) return "Ready to start judging";
  return next === 0 ? "Schema next" : `${steps[next - 1][0]} done · ${steps[next][0].toLowerCase()} next`;
}

function statusFor(stage: Stage, published: boolean, phase: Hackathon["currentPhase"]) {
  if (stage === "setup") return "Setup — draft";
  if (stage === "judging") return phase ? `Judging — ${phase.name.toLowerCase()}` : "Judging";
  return published ? "Results published" : "Results — draft";
}

// Counts and progress are only loaded for the home page list; elsewhere they read as 0.
export function toHackathon(row: HackathonRow): Hackathon {
  const phase = currentPhase(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.name.split(/\s+/).slice(0, 2).join(" "),
    tagline: row.tagline,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    dates: formatDates(row.starts_on, row.ends_on),
    projects: count(row.projects),
    judges: count(row.judges),
    stage: row.stage,
    status: statusFor(row.stage, row.published, phase),
    progress: progressOf(row),
    setupProgress: setupProgress(row),
    color: row.color,
    logo: row.logo || initials(row.name) || "?",
    logoUrl: hackathonLogoUrl(row.logo_path),
    logoPath: row.logo_path,
    bannerUrl: hackathonBannerUrl(row.banner_path ?? null),
    bannerPath: row.banner_path ?? null,
    published: row.published,
    judgingStartedAt: row.judging_started_at,
    currentPhase: phase,
  };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function currentUserId(supabase: Client) {
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

/** Who's signed in, and whether it's a demo account (app_metadata, so server-set). */
async function currentViewer(supabase: Client) {
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub, demo: data.claims.app_metadata?.demo === true };
}

/** The signed-in admin's hackathons, newest first. A demo account gets the demo hackathons. */
export async function listHackathons(): Promise<Hackathon[]> {
  const supabase = await createClient();
  const viewer = await currentViewer(supabase);
  if (!viewer) return [];

  const query = supabase.from("hackathons").select(LIST_COLUMNS);
  const { data, error } = await (viewer.demo ? query.eq("demo", true) : query.eq("owner_id", viewer.id))
    .not("judging_phases.done.submitted_at", "is", null)
    // Progress is the judges' assignments; an admin's own review has no judge.
    .not("judging_phases.assigned.judge_id", "is", null)
    .not("judging_phases.done.judge_id", "is", null)
    .order("created_at", { ascending: false })
    .returns<HackathonRow[]>();
  if (error) throw new Error(`Couldn't load hackathons: ${error.message}`);
  return data.map(toHackathon);
}

/**
 * A hackathon the signed-in user can look at, by slug: one of theirs, or for a
 * demo account a demo hackathon, marked `readOnly`. Backs the /h admin pages.
 * Server actions use getHackathon() instead, which only returns your own.
 */
export const getViewableHackathon = cache(async (slug: string): Promise<Hackathon | null> => {
  const supabase = await createClient();
  const viewer = await currentViewer(supabase);
  if (!viewer) return null;

  const query = supabase.from("hackathons").select(COLUMNS).eq("slug", slug);
  const { data, error } = await (viewer.demo ? query.eq("demo", true) : query.eq("owner_id", viewer.id))
    .maybeSingle<HackathonRow>();
  if (error) throw new Error(`Couldn't load hackathon: ${error.message}`);
  if (!data) return null;
  return { ...toHackathon(data), readOnly: data.owner_id !== viewer.id };
});

/**
 * One of the signed-in admin's hackathons by slug, or null. Server actions
 * check ownership with it before changing anything; pages use
 * getViewableHackathon(), which also lets demo accounts in.
 */
export const getHackathon = cache(async (slug: string): Promise<Hackathon | null> => {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("hackathons")
    .select(COLUMNS)
    .eq("slug", slug)
    .eq("owner_id", userId)
    .maybeSingle<HackathonRow>();
  if (error) throw new Error(`Couldn't load hackathon: ${error.message}`);
  if (!data) return null;
  return toHackathon(data);
});

/**
 * A hackathon for the public winners page. RLS returns it to anyone once
 * published, and to its owner before that (so they can preview).
 */
export const getPublicHackathon = cache(async (slug: string): Promise<Hackathon | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hackathons")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle<HackathonRow>();
  if (error) throw new Error(`Couldn't load hackathon: ${error.message}`);
  if (!data) return null;
  return toHackathon(data);
});

/**
 * The banner URL for /w/[slug], which loads everything else through
 * public_results(). Same visibility as getPublicHackathon().
 */
export const getPublicBannerUrl = cache(async (slug: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hackathons")
    .select("banner_path")
    .eq("slug", slug)
    .maybeSingle<{ banner_path: string | null }>();
  // No column before the migration; either way a banner isn't worth failing the page over.
  if (error) return null;
  return hackathonBannerUrl(data?.banner_path ?? null);
});
