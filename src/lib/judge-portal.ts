import { cache } from "react";
import {
  DEFAULT_PORTAL_SETTINGS,
  type JudgePortalSettings,
  type ProjectValue,
  type Scale,
  type SchemaBlock,
  type Stage,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Reads for supabase/migrations/*_judge_links.sql. A judge's page (/j/<token>)
// has no signed-in user: public.judge_portal() checks the token itself and
// only returns that judge's own queue, so it runs with the public key as
// whoever opened the link. The portal settings are read as the owner.

/** What's in a judge's link: 24–64 URL-safe characters. */
export const JUDGE_TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

/** Rough minutes a judge spends per project, as the distribution preview estimates. */
export const MINUTES_PER_PROJECT = 4;

export type PortalCriterion = {
  id: string;
  title: string;
  description: string;
  scale: Scale;
  weight: number;
  gate: boolean;
};

/** One project in the judge's queue for the running phase. */
export type PortalItem = {
  /** The judge assignment's id. */
  id: string;
  number: number;
  /** 0-based place in the judge's queue. */
  idx: number;
  /** Daily batch it belongs to, 0-based; always 0 when everything goes out at once. */
  batch: number;
  /** Open to score now. Later batches stay shut until their day, or until the judge asks for more. */
  open: boolean;
  submittedAt: string | null;
  /** The judge's weighted total, once submitted. */
  score: number | null;
  /** They changed their score after seeing the agent's, which they can do once. */
  adjusted: boolean;
  /** Null while its batch is shut. */
  name: string | null;
  pitch: string | null;
};

/** The project the judge has open, with everything they need to score it. */
export type PortalCurrent = {
  id: string;
  number: number;
  values: Record<string, ProjectValue>;
  /** The judge's scores so far: criterion id → 1–10, or pass/fail. */
  scores: Record<string, number | boolean>;
  notes: string;
  submittedAt: string | null;
  total: number | null;
  adjustedAt: string | null;
  /** Submitting will show the agent's verdicts. */
  agentReady: boolean;
  /** The agent's verdicts, once the judge has submitted (when the hackathon shows them). */
  agent: { total: number | null; gatePassed: boolean | null; scores: Record<string, number | boolean> } | null;
};

export type JudgePortal = {
  hackathon: {
    name: string;
    slug: string;
    tagline: string;
    color: string;
    logo: string | null;
    logoPath: string | null;
    stage: Stage;
    judgingStartedAt: string | null;
  };
  judge: { id: string; name: string; title: string; imagePath: string | null };
  settings: JudgePortalSettings;
  /** The running phase, or null when none is. */
  phase: { id: string; name: string; index: number; count: number; startedAt: string } | null;
  showAgentScore: boolean;
  criteria: PortalCriterion[];
  blocks: SchemaBlock[];
  /** The judge's queue in the running phase, in order. */
  queue: PortalItem[];
  /** How the queue is paced; null when it's empty. */
  plan: { daily: boolean; day: number; perDay: number; nextAt: string | null } | null;
  current: PortalCurrent | null;
};

export type PortalRow = {
  hackathon: {
    name: string;
    slug: string;
    tagline: string;
    color: string;
    logo: string | null;
    logo_path: string | null;
    stage: Stage;
    judging_started_at: string | null;
  };
  judge: { id: string; name: string; title: string; image_path: string | null };
  settings: { welcome_title: string; welcome_message: string; goals: string[]; done_message: string } | null;
  phase: { id: string; name: string; index: number; count: number; started_at: string } | null;
  show_agent_score: boolean;
  criteria: PortalCriterion[];
  blocks: SchemaBlock[];
  queue: {
    id: string;
    number: number;
    idx: number;
    batch: number;
    open: boolean;
    submitted_at: string | null;
    score: number | string | null;
    adjusted: boolean;
    name: string | null;
    pitch: string | null;
  }[];
  plan: { daily: boolean; day: number; per_day: number; next_at: string | null } | null;
  current: {
    id: string;
    number: number;
    values: Record<string, ProjectValue>;
    scores: Record<string, number | boolean>;
    notes: string;
    submitted_at: string | null;
    total: number | string | null;
    adjusted_at: string | null;
    agent_ready: boolean;
    agent: { total: number | string | null; gate_passed: boolean | null; scores: Record<string, number | boolean> } | null;
  } | null;
};

// numeric columns come back as numbers or strings depending on size.
const num = (v: number | string | null) => (v === null ? null : Number(v));

const toSettings = (s: PortalRow["settings"]): JudgePortalSettings =>
  s
    ? { welcomeTitle: s.welcome_title, welcomeMessage: s.welcome_message, goals: s.goals, doneMessage: s.done_message }
    : DEFAULT_PORTAL_SETTINGS;

/**
 * Everything a judge's link shows, or null when the token doesn't open
 * anything. With `assignmentId` (one of their open projects) it includes that
 * project in `current`. Cached per request, so the page and its metadata share it.
 */
export const getJudgePortal = cache(async (token: string, assignmentId: string | null = null): Promise<JudgePortal | null> => {
  if (!JUDGE_TOKEN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("judge_portal", { p_token: token, p_assignment_id: assignmentId });
  if (error) throw new Error(`Couldn't load your judging queue: ${error.message}`);
  return data ? toJudgePortal(data as PortalRow) : null;
});

/** public.judge_portal()'s result in app shape. Also used by the email workflows, which call it with the secret key. */
export function toJudgePortal(row: PortalRow): JudgePortal {
  const c = row.current;
  return {
    hackathon: {
      name: row.hackathon.name,
      slug: row.hackathon.slug,
      tagline: row.hackathon.tagline,
      color: row.hackathon.color,
      logo: row.hackathon.logo,
      logoPath: row.hackathon.logo_path,
      stage: row.hackathon.stage,
      judgingStartedAt: row.hackathon.judging_started_at,
    },
    judge: { id: row.judge.id, name: row.judge.name, title: row.judge.title, imagePath: row.judge.image_path },
    settings: toSettings(row.settings),
    phase: row.phase && {
      id: row.phase.id,
      name: row.phase.name,
      index: row.phase.index,
      count: row.phase.count,
      startedAt: row.phase.started_at,
    },
    showAgentScore: row.show_agent_score,
    criteria: row.criteria,
    blocks: row.blocks,
    queue: row.queue.map((q) => ({
      id: q.id,
      number: q.number,
      idx: q.idx,
      batch: q.batch,
      open: q.open,
      submittedAt: q.submitted_at,
      score: num(q.score),
      adjusted: q.adjusted,
      name: q.name,
      pitch: q.pitch,
    })),
    plan: row.plan && { daily: row.plan.daily, day: row.plan.day, perDay: row.plan.per_day, nextAt: row.plan.next_at },
    current: c && {
      id: c.id,
      number: c.number,
      values: c.values,
      scores: c.scores,
      notes: c.notes,
      submittedAt: c.submitted_at,
      total: num(c.total),
      adjustedAt: c.adjusted_at,
      agentReady: c.agent_ready,
      agent: c.agent && { total: num(c.agent.total), gatePassed: c.agent.gate_passed, scores: c.agent.scores },
    },
  };
}

/** A hackathon's start and end screen copy for judges, or the defaults. RLS limits it to the owner. */
export async function getPortalSettings(hackathonId: string): Promise<JudgePortalSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("judge_portal_settings")
    .select("welcome_title, welcome_message, goals, done_message")
    .eq("hackathon_id", hackathonId)
    .maybeSingle<NonNullable<PortalRow["settings"]>>();
  if (error) throw new Error(`Couldn't load the judge portal settings: ${error.message}`);
  return toSettings(data);
}

/** The first name, for "Welcome, Marcus". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
