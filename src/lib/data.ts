// Mock data for the RoundZero screens. Shapes mirror what a real backend would
// return so pages can later swap these reads for queries.

export type Stage = "setup" | "judging" | "results";

/** The page each stage opens on, under /h/[slug]/. */
export const STAGE_HOME: Record<Stage, string> = { setup: "setup/schema", judging: "judging/projects", results: "results" };

export type Hackathon = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  /** ISO dates (yyyy-mm-dd), null until set. */
  startsOn: string | null;
  endsOn: string | null;
  /** Display string, e.g. "Oct 3–5". */
  dates: string;
  projects: number;
  judges: number;
  stage: Stage;
  status: string;
  progress: number;
  /** Home page list, setup stage only: where setup is up to, e.g. "Criteria done · judges next". */
  setupProgress?: string;
  color: string;
  logo: string;
  /** Public URL of the uploaded logo image; `logo` initials show until there is one. */
  logoUrl: string | null;
  /** Object path of the uploaded logo in the hackathon-logos bucket. */
  logoPath: string | null;
  /** Public URL of the uploaded banner; the pixel-art cover shows until there is one. */
  bannerUrl: string | null;
  /** Object path of the uploaded banner in the hackathon-banners bucket. */
  bannerPath: string | null;
  published?: boolean;
  /** When judging started; null while still in setup. */
  judgingStartedAt: string | null;
  /** The phase judging is in now, or null before it starts and after the last one closes. */
  currentPhase: { name: string; index: number; count: number } | null;
  /** The viewer can look but not change anything: a demo account on a demo hackathon. */
  readOnly?: boolean;
};

export const org = {
  name: "Acme",
  orgLabel: "Acme Org",
  domain: "roundzero.dev/acme",
  me: { name: "Priya N.", role: "admin" },
};

// Real hackathons live in Supabase (see lib/hackathons.ts). This one only
// backs the judge link demo until judges and projects move to the database.
export const demoHackathon: Hackathon = {
  id: "demo",
  slug: "ai-agents-2026",
  name: "AI Agents Hack 2026",
  shortName: "AI Agents",
  tagline: "Build agents that ship real work.",
  startsOn: "2026-10-03",
  endsOn: "2026-10-05",
  dates: "Oct 3–5",
  projects: 112,
  judges: 10,
  stage: "judging",
  status: "Judging — phase 1",
  progress: 45,
  color: "#6e56e7",
  logo: "AA",
  logoUrl: null,
  logoPath: null,
  bannerUrl: null,
  bannerPath: null,
  judgingStartedAt: "2026-10-06T09:00:00Z",
  currentPhase: { name: "Group review", index: 0, count: 2 },
};

// ── Setup › Project schema ────────────────────────────────────────────────

export type BlockType =
  | "text"
  | "long text"
  | "number"
  | "url"
  | "video url"
  | "repo url"
  | "file"
  | "select"
  | "image"
  | "team";

export const blockTypes: { type: BlockType; label: string; icon: IconName }[] = [
  { type: "text", label: "Text", icon: "text" },
  { type: "long text", label: "Long text", icon: "paragraph" },
  { type: "number", label: "Number", icon: "hash" },
  { type: "url", label: "URL", icon: "link" },
  { type: "video url", label: "Video", icon: "play" },
  { type: "repo url", label: "Repo", icon: "branch" },
  { type: "file", label: "File", icon: "clip" },
  { type: "select", label: "Select", icon: "check" },
  { type: "image", label: "Image", icon: "image" },
  { type: "team", label: "Team", icon: "users" },
];

/** A row of public.schema_blocks, as the editor works with it. */
export type SchemaBlock = {
  id: string;
  title: string;
  type: BlockType;
  description: string;
  expected: string;
};

// ── Setup › Judging criteria ──────────────────────────────────────────────

export type Mechanism =
  | "agent_judge"
  | "sandbox_run"
  | "video_reviewer"
  | "code_scraper"
  | "web_scraper"
  | "human_only";

export const mechanisms: { id: Mechanism; name: string; icon: IconName; does: string }[] = [
  { id: "agent_judge", name: "Agent judge", icon: "spark", does: "LLM reads inputs, scores against the rubric" },
  { id: "sandbox_run", name: "Sandbox run", icon: "gear", does: "Clones and builds the repo, runs tests" },
  { id: "video_reviewer", name: "Video reviewer", icon: "play", does: "Transcript, scene check, length check" },
  { id: "code_scraper", name: "Code scraper", icon: "search", does: "Greps the repo for imports and call sites" },
  { id: "web_scraper", name: "Web scraper", icon: "globe", does: "Visits the live demo, captures pages" },
  { id: "human_only", name: "Human only", icon: "user", does: "No agent score — judges only" },
];

export type Scale = "score" | "pass_fail";

/** How much model the agent spends on a criterion: see lib/agent/tiers.ts. */
export type ModelTier = "quick" | "balanced" | "deep";

/** When a second, larger model checks the agent's verdict. */
export type DoubleCheck = "off" | "auto" | "always";

/** A row of public.criteria, with its inputs as schema block ids. */
export type Criterion = {
  id: string;
  title: string;
  scale: Scale;
  description: string;
  /** Schema block ids the criterion reads; empty means all inputs. */
  inputs: string[];
  mechanisms: Mechanism[];
  weight: number;
  /** When its inputs are empty: judge what's there, or score 0. */
  ifMissing: "judge" | "zero";
  /** Failing a pass/fail gate makes the project ineligible. */
  gate: boolean;
  /** What the agent should look for, in the organizer's words. */
  agentGuidance: string;
  agentModel: ModelTier;
  /** Packages, APIs, SDKs or keywords the code mechanisms search the repo for. */
  lookFor: string[];
  /** Shell commands for sandbox runs; empty lets the agent work out install, build and test. */
  sandboxCommands: string;
  doubleCheck: DoubleCheck;
};

/** Agent settings a new criterion starts with. */
export const DEFAULT_AGENT_SETTINGS = {
  agentGuidance: "",
  agentModel: "balanced",
  lookFor: [],
  sandboxCommands: "",
  doubleCheck: "auto",
} satisfies Pick<Criterion, "agentGuidance" | "agentModel" | "lookFor" | "sandboxCommands" | "doubleCheck">;

// Real criteria live in Supabase (see lib/criteria.ts). These back the judge
// link demo and project page until scoring moves to the database.
export const criteria: Criterion[] = [
  {
    id: "tech",
    title: "Technical execution",
    scale: "score",
    description: "Code runs, is structured, and does what the demo claims.",
    inputs: [],
    mechanisms: ["sandbox_run", "agent_judge"],
    weight: 30,
    ifMissing: "zero",
    gate: false,
    ...DEFAULT_AGENT_SETTINGS,
  },
  {
    id: "video",
    title: "Video: problem & solution",
    scale: "score",
    description: "Video clearly states the problem and shows the working solution within 3 minutes.",
    inputs: [],
    mechanisms: ["video_reviewer"],
    weight: 25,
    ifMissing: "zero",
    gate: false,
    ...DEFAULT_AGENT_SETTINGS,
  },
  {
    id: "sdk",
    title: "Uses Acme SDK",
    scale: "pass_fail",
    description: "Repo imports the Acme SDK and calls it meaningfully (not just installed).",
    inputs: [],
    mechanisms: ["code_scraper", "agent_judge"],
    weight: 25,
    ifMissing: "zero",
    gate: true,
    ...DEFAULT_AGENT_SETTINGS,
    lookFor: ["@acme/sdk", "acme.generate("],
  },
  {
    id: "orig",
    title: "Originality & design",
    scale: "score",
    description: "Novel idea, thoughtful UX.",
    inputs: [],
    mechanisms: ["agent_judge"],
    weight: 20,
    ifMissing: "judge",
    gate: false,
    ...DEFAULT_AGENT_SETTINGS,
  },
];

// ── Setup › Judges ────────────────────────────────────────────────────────

/** An option of a custom judge field, e.g. "Anthropic" for "Company". */
export type JudgeFieldOption = { id: string; label: string };

/** A row of public.judge_fields with its options, in order. */
export type JudgeField = { id: string; name: string; options: JudgeFieldOption[] };

/** A row of public.judges, with its field values. */
export type JudgeProfile = {
  id: string;
  name: string;
  title: string;
  email: string;
  /** Object path in the judge-images bucket. */
  imagePath: string | null;
  /** Field id → option id. Fields with no value are absent. */
  values: Record<string, string>;
  /** The secret in the judge's private link, /j/<accessToken>. Absent until the judge is saved. */
  accessToken?: string;
};

/** A saved group of judges. */
export type JudgeGroup = { id: string; name: string; members: string[] };

/** A row of public.judge_portal_settings: the start and end screens on judges' links. */
export type JudgePortalSettings = {
  /** Headline on the start screen; empty greets the judge by name. */
  welcomeTitle: string;
  /** A note from the organizers, under the headline. */
  welcomeMessage: string;
  /** "Remember the goal": short points judges read before they start. */
  goals: string[];
  /** Shown once a judge has scored everything they have. */
  doneMessage: string;
};

export const DEFAULT_PORTAL_SETTINGS: JudgePortalSettings = {
  welcomeTitle: "",
  welcomeMessage: "",
  goals: [],
  doneMessage: "",
};

export type JudgeDirectory = { judges: JudgeProfile[]; fields: JudgeField[]; groups: JudgeGroup[] };

// ── Judges (mock, judging stage) ──────────────────────────────────────────

export type Judge = {
  id: string;
  name: string;
  title: string;
  tag?: "admin" | "invited" | "final panel";
  assigned: number;
  done: number;
};

export const judges: Judge[] = [
  { id: "priya", name: "Priya N.", title: "Staff Eng · Acme", tag: "admin", assigned: 23, done: 16 },
  { id: "marcus", name: "Marcus O.", title: "DevRel", tag: "invited", assigned: 22, done: 9 },
  { id: "lena", name: "Lena K.", title: "Partner · VC", tag: "final panel", assigned: 22, done: 14 },
  { id: "sam", name: "Sam T.", title: "Founder · Tiny Labs", assigned: 23, done: 12 },
  { id: "ada", name: "Ada R.", title: "ML Eng · Acme", assigned: 22, done: 11 },
  { id: "jonah", name: "Jonah W.", title: "Designer", assigned: 22, done: 4 },
  { id: "mei", name: "Mei L.", title: "Product · Acme", assigned: 22, done: 13 },
  { id: "omar", name: "Omar F.", title: "Security Eng", assigned: 23, done: 3 },
  { id: "tess", name: "Tess B.", title: "Community", assigned: 22, done: 10 },
  { id: "diego", name: "Diego M.", title: "CTO · Acme", assigned: 23, done: 9 },
];

// ── Projects ──────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  name: string;
  pitch: string;
  team: number;
  repo: string;
  demo?: string;
  agent: number;
  score: number;
  reviews: number;
  status: "advanced" | "in review" | "agent-failed" | "unreviewed";
  group: string;
};

export const projects: Project[] = [
  { id: "047", name: "Repo Whisperer", pitch: "Ask any codebase anything", team: 3, repo: "github.com/team/repo-whisperer", demo: "repowhisperer.app", agent: 7.4, score: 7.2, reviews: 2, status: "advanced", group: "B" },
  { id: "012", name: "Ledgerly", pitch: "Agentic bookkeeping for indie devs", team: 2, repo: "github.com/ledgerly/app", demo: "ledgerly.dev", agent: 8.1, score: 8.3, reviews: 2, status: "advanced", group: "A" },
  { id: "088", name: "Nightshift", pitch: "Overnight agent that fixes flaky tests", team: 1, repo: "github.com/nightshift/ns", agent: 8.0, score: 8.2, reviews: 2, status: "advanced", group: "C" },
  { id: "091", name: "Cartographer", pitch: "Maps your infra from Terraform + logs", team: 4, repo: "github.com/carto/cartographer", demo: "carto.sh", agent: 6.2, score: 6.9, reviews: 2, status: "advanced", group: "B" },
  { id: "063", name: "Pocket QA", pitch: "A QA agent that lives in your PRs", team: 2, repo: "github.com/pocketqa/pqa", agent: 8.0, score: 7.0, reviews: 2, status: "in review", group: "B" },
  { id: "019", name: "Standup Bot", pitch: "Writes your standup from yesterday's commits", team: 2, repo: "github.com/sb/standup", agent: 6.8, score: 6.6, reviews: 1, status: "in review", group: "A" },
  { id: "104", name: "Menu Mind", pitch: "Voice ordering agent for small restaurants", team: 3, repo: "github.com/mm/menumind", demo: "menumind.ai", agent: 7.1, score: 0, reviews: 0, status: "unreviewed", group: "D" },
  { id: "071", name: "Grant Scout", pitch: "Finds and drafts research grant applications", team: 2, repo: "github.com/gs/scout", agent: 3.2, score: 0, reviews: 0, status: "agent-failed", group: "—" },
  { id: "033", name: "Changelog Crow", pitch: "Turns merged PRs into release notes", team: 1, repo: "github.com/crow/changelog", agent: 6.5, score: 6.4, reviews: 2, status: "in review", group: "C" },
  { id: "058", name: "Tripwire", pitch: "Agent that watches prod and files good bugs", team: 3, repo: "github.com/tw/tripwire", agent: 7.7, score: 7.8, reviews: 2, status: "advanced", group: "D" },
];

// ── Judging › Phases, distribution, projects (Supabase) ──────────────────

/** A row of public.judging_phases. */
export type JudgingPhase = {
  id: string;
  name: string;
  /** Judge group that reviews in this phase; null means every judge. */
  judgeGroupId: string | null;
  /** Judges per project; null means every judge in the pool sees every project. */
  reviewsPerProject: number | null;
  /** Projects that go on to the next phase; null on the last phase. */
  advanceCount: number | null;
  /** Hex color in the progress funnel; null uses the default for its position. */
  color: string | null;
  /** Set when judging reaches this phase, and when it's closed. */
  startedAt: string | null;
  closedAt: string | null;
};

export type FailedInboxOwner = "admin" | "judge" | "nobody";

/** The row of public.distribution_settings for a hackathon (defaults when there's none). */
export type DistributionSettings = {
  agentFirst: boolean;
  /** Who reviews projects the agent failed on a gate: the admin, one judge (inboxJudgeId), or nobody. */
  failedInbox: FailedInboxOwner;
  /** The judge when failedInbox is "judge"; null otherwise. */
  inboxJudgeId: string | null;
  strategy: "even" | "mixed";
  cadence: "once" | "daily";
  batchDays: number;
  showAgentScore: boolean;
  /**
   * What reviews that fail a gate do: flag the project for an admin, or rule
   * it out once judgeGateCount reviews fail the same gate.
   */
  judgeGate: "flag" | "rule_out";
  judgeGateCount: number;
};

export type ProjectStatus = "active" | "eliminated" | "disqualified";

/** Strings for text and link blocks, a number for number blocks, a list for images, files and team. */
export type ProjectValue = string | number | string[];

/** A row of public.projects with its values keyed by schema block id. */
export type ProjectRecord = {
  id: string;
  number: number;
  phaseId: string | null;
  status: ProjectStatus;
  /** Place in the final ranking, set when the last phase closes. */
  finalRank: number | null;
  /** Where the team hears about results; "" when none was given. */
  contactEmail: string;
  values: Record<string, ProjectValue>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectEventKind =
  | "submitted"
  | "edited"
  | "moved"
  | "eliminated"
  | "reinstated"
  | "disqualified"
  | "note"
  | "agent_scored"
  | "judge_scored"
  | "judging_reset"
  | "ranked"
  | "awarded"
  | "award_removed"
  | "agent_rescored"
  | "agent_overridden"
  | "agent_flagged"
  | "agent_gate_decided";

/** A row of public.project_events: one line of a project's audit trail. */
export type ProjectEvent = {
  id: string;
  kind: ProjectEventKind;
  actorKind: "admin" | "agent" | "judge" | "system";
  /** The signed-in user who did it; null for agents and the system. */
  actorId?: string | null;
  actorName: string;
  data: Record<string, unknown>;
  createdAt: string;
};

// ── Results ───────────────────────────────────────────────────────────────

export const ranking = [
  { id: "047", name: "Repo Whisperer", team: "team of 3", score: 8.9, prize: "Grand prize" },
  { id: "012", name: "Ledgerly", team: "team of 2", score: 8.6, prize: "2nd" },
  { id: "088", name: "Nightshift", team: "solo", score: 8.4, prize: "3rd" },
  { id: "091", name: "Cartographer", team: "team of 4", score: 8.1 },
  { id: "063", name: "Pocket QA", team: "team of 2", score: 7.9 },
  { id: "058", name: "Tripwire", team: "team of 3", score: 7.8 },
  { id: "033", name: "Changelog Crow", team: "solo", score: 7.6 },
  { id: "019", name: "Standup Bot", team: "team of 2", score: 7.4 },
  { id: "104", name: "Menu Mind", team: "team of 3", score: 7.3 },
  { id: "071", name: "Grant Scout", team: "team of 2", score: 7.1 },
];

export const categories = [
  { name: "Best use of Acme SDK", winner: "Nightshift" },
  { name: "Best demo video", winner: "Ledgerly" },
];

export type RewardKind = "cash" | "credits" | "link" | "code" | "text" | "image" | "file" | "swag";

export type RewardItem = {
  id: string;
  kind: RewardKind;
  label: string;
  /** The redeemable part: a URL for links and files, a code for codes and credits. */
  detail: string;
};

/** Who wins a tier: a range of final ranks, or an award with its own picked winners. */
export type RewardRecipients = "ranks" | "award";

/** How an award's winners are chosen: by hand, or suggested by the top scores on one criterion. */
export type AwardPick = "manual" | "criterion";

export type RewardTier = {
  id: string;
  name: string;
  description: string;
  recipients: RewardRecipients;
  /** Set when recipients is "ranks"; 1-based and inclusive. */
  rankFrom: number | null;
  rankTo: number | null;
  /** Set when recipients is "award". */
  winnerCount: number | null;
  pick: AwardPick | null;
  criterionId: string | null;
  /** Projects that already won a rank tier can't also win this award. */
  exclusive: boolean;
  /** Square prize image in the reward-images bucket. */
  imagePath: string | null;
  items: RewardItem[];
};

/** "Rank 1", "Ranks 2–3", "Top 10", "Award · 2 winners"… */
export function rewardWinners(t: Pick<RewardTier, "recipients" | "rankFrom" | "rankTo" | "winnerCount">) {
  if (t.recipients === "award") return t.winnerCount && t.winnerCount > 1 ? `Award · ${t.winnerCount} winners` : "Award";
  if (t.rankFrom === null || t.rankTo === null) return "Ranks —";
  if (t.rankFrom === t.rankTo) return `Rank ${t.rankFrom}`;
  if (t.rankFrom === 1) return `Top ${t.rankTo}`;
  return `Ranks ${t.rankFrom}–${t.rankTo}`;
}

/** Winner email copy for a hackathon. Blank fields fall back to the defaults. */
export type RewardEmail = {
  fromName: string;
  title: string;
  description: string;
  linkUrl: string;
  linkLabel: string;
  finePrint: string;
};

export const emptyRewardEmail: RewardEmail = {
  fromName: "",
  title: "",
  description: "",
  linkUrl: "",
  linkLabel: "",
  finePrint: "",
};

export const REWARD_EMAIL_DEFAULTS = { title: "Congrats, {project}!", linkLabel: "Claim your rewards" };

/** Fill {project}, {hackathon} and {rank} in winner email copy. {rank} is "–" for award-only winners. */
export const fillEmailCopy = (copy: string, vars: { project: string; hackathon: string; rank: number | null }) =>
  copy.replace(/\{(project|hackathon|rank)\}/g, (_, key: keyof typeof vars) =>
    key === "rank" ? (vars.rank === null ? "–" : String(vars.rank)) : vars[key],
  );

/**
 * The thank-you email to every project that didn't win: the winners, and an
 * optional gift for everyone who took part. Blank text falls back to the defaults.
 */
export type ThankYouEmailSettings = {
  enabled: boolean;
  fromName: string;
  subject: string;
  title: string;
  /** Fills {project} and {hackathon}, like the winner email. */
  message: string;
  showWinners: boolean;
  giftTitle: string;
  giftDescription: string;
  /** Same kinds as prizes: a credits code, a discount link, swag… Empty leaves the gift out. */
  giftItems: RewardItem[];
  linkUrl: string;
  linkLabel: string;
  finePrint: string;
};

export const emptyThankYouEmail: ThankYouEmailSettings = {
  enabled: true,
  fromName: "",
  subject: "",
  title: "",
  message: "",
  showWinners: true,
  giftTitle: "",
  giftDescription: "",
  giftItems: [],
  linkUrl: "",
  linkLabel: "",
  finePrint: "",
};

export const THANK_YOU_EMAIL_DEFAULTS = {
  subject: "{hackathon}: the winners, and a thank-you for {project}",
  title: "Thank you for building {project}",
  message:
    "Every project in {hackathon} got a proper look from the judges, and yours was part of a field that made their job genuinely hard. Shipping something real in a weekend is no small thing.",
  giftTitle: "A thank-you for taking part",
  linkLabel: "Learn more",
};

/** The rank-based tiers a project finishing at `rank` wins. */
export const tiersForRank = (tiers: RewardTier[], rank: number) =>
  tiers.filter((t) => t.recipients === "ranks" && t.rankFrom !== null && t.rankTo !== null && t.rankFrom <= rank && rank <= t.rankTo);

/** Hackathon-wide reward rules, from Judging › Rewards › Settings. */
export type RewardSettings = {
  /**
   * A person or team with several projects wins at most one reward. Projects
   * are the same entrant when they share a member in a Team field.
   */
  oneWinPerEntrant: boolean;
};

export const defaultRewardSettings: RewardSettings = { oneWinPerEntrant: false };

// ── Agent judging notes ───────────────────────────────────────────────────

export type Rule = {
  id: string;
  source: "disagreement" | "admin" | "past";
  title: string;
  meta: string;
  state: "proposed" | "active";
  quote?: string;
  who?: string;
  when?: string;
  affects?: number;
};

export const rules: Rule[] = [
  {
    id: "r1",
    source: "disagreement",
    state: "proposed",
    who: "Marcus O. · #047 · Technical execution 7 → 5",
    when: "Oct 8",
    quote: "Tests are stubs; sandbox counted them as passing.",
    title:
      "Inspect test bodies. If tests contain no assertions or only trivial ones, treat the suite as absent when scoring Technical execution.",
    meta: "agent-drafted, editable",
    affects: 9,
  },
  {
    id: "r2",
    source: "disagreement",
    state: "active",
    title: "Video over 3:00 is a soft penalty, not a zero",
    meta: "from Priya N. disagreement · #012 · applies: this hackathon + future",
  },
  {
    id: "r3",
    source: "past",
    state: "active",
    title: "Reward working run instructions, not README length",
    meta: "org library · Spring Build Week 2026 · used in 2 hackathons",
  },
  {
    id: "r4",
    source: "admin",
    state: "active",
    title: "A demo that only runs locally still counts if the video shows it working",
    meta: "written by Priya N. · this hackathon",
  },
];

// Icon names shared across data + components.
export type IconName =
  | "text"
  | "paragraph"
  | "hash"
  | "link"
  | "play"
  | "branch"
  | "clip"
  | "check"
  | "image"
  | "users"
  | "user"
  | "spark"
  | "heart"
  | "gear"
  | "search"
  | "globe"
  | "grip"
  | "plus"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "external"
  | "lock"
  | "flag"
  | "mail"
  | "trophy"
  | "chat"
  | "grid"
  | "list"
  | "x"
  | "gift"
  | "coin"
  | "ticket"
  | "tag"
  | "eye"
  | "dot"
  | "table"
  | "check-list"
  | "paint-brush"
  | "calendar"
  | "chart-line"
  | "notebook"
  | "crown"
  | "code"
  | "copy"
  | "trash"
  | "x-circle"
  | "ban"
  | "refresh"
  | "inbox";

export const rewardIcon: Record<RewardKind, IconName> = {
  cash: "coin",
  credits: "ticket",
  link: "link",
  code: "hash",
  text: "text",
  image: "image",
  file: "clip",
  swag: "tag",
};
