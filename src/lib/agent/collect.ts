import { visionModelId } from "@/lib/ai";
import type { Criterion, Mechanism, ModelTier, ProjectValue, SchemaBlock } from "@/lib/data";
import { hasValue, valueText } from "@/lib/project-fields";
import { checkLink, clip, tail } from "./fetch";
import type { Section } from "./judge";
import type { StepRecorder } from "./recorder";
import { describeRepo, parseRepoUrl, searchRepo, snapshotRepo, type RepoSnapshot } from "./repo";
import { sandboxLabel, sandboxStatus, type CommandResult, type RepoSandbox } from "./sandbox";
import type { Flag } from "./types";
import { describeVideo, formatTime, inspectVideo, vimeoId, youtubeId, type VideoInfo } from "./video";
import { describeImages, viewImages } from "./vision";
import { crawlSite, readPages, type PageRead } from "./web";

// Step one of judging a criterion: gather evidence with each of its
// mechanisms. The judge reads the result as <evidence> sections, and the
// investigation tools pick up where this leaves off.

/** Shared across a project's steps, so the repo is cloned and the video fetched once. */
export class ProjectResources {
  private cache = new Map<string, Promise<unknown>>();

  once<T>(key: string, load: () => Promise<T>): Promise<T> {
    let p = this.cache.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load();
      // Callers handle the rejection; this just keeps an unawaited copy from being "unhandled".
      p.catch(() => {});
      this.cache.set(key, p);
    }
    return p;
  }
}

// ── Inputs ────────────────────────────────────────────────────────────────

export type Link = { block: SchemaBlock; url: string };

export type StepInputs = {
  blocks: SchemaBlock[];
  filled: SchemaBlock[];
  missing: SchemaBlock[];
  repos: Link[];
  videos: Link[];
  pages: Link[];
  images: Link[];
};

const IMAGE_FILE = /\.(png|jpe?g|gif|webp)(\?|#|$)/i;
const isVideoLink = (url: string) => Boolean(youtubeId(url) || vimeoId(url) || /loom\.com\/(share|embed)\//i.test(url));

/**
 * The criterion's inputs, and the links in them sorted by what they point
 * at, whatever field they came in: a GitHub link in a "Demo" field still
 * gets read as a repo.
 */
export function resolveInputs(criterion: Criterion, blocks: SchemaBlock[], values: Record<string, ProjectValue>): StepInputs {
  const chosen = criterion.inputs.length ? blocks.filter((b) => criterion.inputs.includes(b.id)) : blocks;
  const out: StepInputs = {
    blocks: chosen,
    filled: chosen.filter((b) => hasValue(values[b.id])),
    missing: chosen.filter((b) => !hasValue(values[b.id])),
    repos: [],
    videos: [],
    pages: [],
    images: [],
  };
  for (const block of out.filled) {
    if (!["url", "video url", "repo url", "image", "file"].includes(block.type)) continue;
    const v = values[block.id];
    for (const url of (Array.isArray(v) ? v : [String(v)]).filter((u) => /^https?:\/\//i.test(u))) {
      const link = { block, url };
      if (block.type === "image" || IMAGE_FILE.test(url)) out.images.push(link);
      else if (block.type === "repo url" || parseRepoUrl(url)) out.repos.push(link);
      else if (block.type === "video url" || isVideoLink(url)) out.videos.push(link);
      else out.pages.push(link);
    }
  }
  return out;
}

/** The submitted fields a criterion reads, as text for the judge. */
export function submissionText(inputs: StepInputs, values: Record<string, ProjectValue>, headline: { name: string; pitch: string }) {
  const lines = [`Project: ${headline.name}${headline.pitch ? ` — ${headline.pitch}` : ""}`];
  for (const b of inputs.filled) {
    lines.push("", `## ${b.title} (${b.type})${b.expected ? ` — the form asks for: ${b.expected}` : ""}`, clip(valueText(values[b.id]), 8000));
  }
  return lines.join("\n");
}

// ── Collecting ────────────────────────────────────────────────────────────

export type CollectContext = {
  criterion: Criterion;
  mechanisms: Mechanism[];
  inputs: StepInputs;
  tier: ModelTier;
  guidance: { from: string; text: string }[];
  resources: ProjectResources;
  rec: StepRecorder;
  signal: AbortSignal;
};

export type Collected = {
  sections: (Section & { order: number })[];
  /** Problems found along the way, e.g. a dead demo link. */
  flags: Flag[];
  snapshot: RepoSnapshot | null;
  /** This step's own branch of the repo's sandbox, for running commands. */
  sandbox: RepoSandbox | null;
  pages: PageRead[];
  video: VideoInfo | null;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export async function collectEvidence(ctx: CollectContext): Promise<Collected> {
  const out: Collected = { sections: [], flags: [], snapshot: null, sandbox: null, pages: [], video: null };
  const has = (m: Mechanism) => ctx.mechanisms.includes(m);
  const tasks: Promise<void>[] = [];
  if (has("code_scraper") || has("sandbox_run")) tasks.push(collectRepo(ctx, out));
  if (has("web_scraper")) tasks.push(collectPages(ctx, out));
  if (has("video_reviewer")) tasks.push(collectVideo(ctx, out));
  await Promise.all(tasks);
  out.sections.sort((a, b) => a.order - b.order);
  return out;
}

async function collectRepo(ctx: CollectContext, out: Collected) {
  const { rec, criterion } = ctx;
  const link = ctx.inputs.repos[0];
  if (!link) {
    out.sections.push({ order: 0, title: "Repo", text: "No repo link in this criterion's inputs, so there's no code to read." });
    return;
  }
  const ref = parseRepoUrl(link.url);
  if (!ref) {
    out.sections.push({ order: 0, title: "Repo", text: `${link.url} isn't a GitHub, GitLab, Bitbucket or Codeberg repo link, so the code couldn't be read.` });
    out.flags.push({ kind: "broken_link", note: `"${link.block.title}" isn't a repo link: ${link.url}` });
    return;
  }

  rec.doing(`Reading ${ref.webUrl}`);
  const started = Date.now();
  let snap: RepoSnapshot;
  try {
    snap = await ctx.resources.once(`repo:${ref.cloneUrl}#${ref.ref ?? ""}:${ref.subdir ?? ""}`, () => snapshotRepo(ref));
  } catch (e) {
    rec.add({ kind: "mechanism", mechanism: "code_scraper", title: `Couldn't read ${ref.webUrl}`, detail: message(e), url: ref.webUrl, ok: false, ms: Date.now() - started });
    out.sections.push({ order: 0, title: `Repo ${ref.webUrl}`, text: `Couldn't read the repo: ${message(e)}` });
    out.flags.push({ kind: "broken_link", note: `Repo ${ref.webUrl}: ${message(e)}` });
    return;
  }
  out.snapshot = snap;
  rec.add({
    kind: "mechanism",
    mechanism: "code_scraper",
    title: snap.via === "archive" ? `Read ${ref.webUrl} from its source archive` : `Cloned ${ref.webUrl} in ${sandboxLabel()}`,
    detail: [`${snap.fileCount} files · ${snap.totalCommits ?? snap.commits.length} commits read`, ...snap.notes].join("\n"),
    url: ref.webUrl,
    ok: true,
    ms: Math.round(snap.seconds * 1000),
  });
  out.sections.push({
    order: 0,
    title: `Repo ${ref.webUrl}`,
    text: [describeRepo(snap), ...snap.notes.map((n) => `Note: ${n}`)].join("\n"),
  });

  if (criterion.lookFor.length) {
    rec.doing(`Searching the repo for ${criterion.lookFor.length} ${criterion.lookFor.length === 1 ? "thing" : "things"}`);
    const searchStarted = Date.now();
    try {
      const results = await searchRepo(snap, criterion.lookFor, ctx.signal);
      const lines = results.map(
        (r) =>
          `"${r.target}": ${r.hits.length ? `${r.hits.length}${r.truncated ? "+" : ""} matches` : "not found anywhere in the repo"}` +
          r.hits
            .slice(0, 12)
            .map((h) => `\n  ${h.path}${h.line ? `:${h.line}` : ""}  ${h.text}`)
            .join(""),
      );
      rec.add({
        kind: "mechanism",
        mechanism: "code_scraper",
        title: `Searched for ${results.map((r) => `${r.target} (${r.hits.length}${r.truncated ? "+" : ""})`).join(", ")}`,
        detail: lines.join("\n"),
        ms: Date.now() - searchStarted,
        ok: true,
      });
      out.sections.push({
        order: 1,
        title: "Repo search for what the organizer asked about",
        text: `Matches in manifests or lockfiles show a package is installed; matches in source files show it's actually used.\n${lines.join("\n")}`,
      });
    } catch (e) {
      rec.add({ kind: "error", title: "Repo search failed", detail: message(e), ok: false });
    }
  }

  if (ctx.mechanisms.includes("sandbox_run")) await runPlan(ctx, out, snap);
}

// ── Sandbox runs ──────────────────────────────────────────────────────────

type PlanStep = { command: string; timeoutSec: number; stopOnFail: boolean };

/** Install, build and test commands guessed from the repo's manifests. */
function autoPlan(snap: RepoSnapshot): { steps: PlanStep[]; stack: string } {
  const has = (f: string) => snap.files.includes(f);
  const pkg = snap.manifests.find((m) => m.path === "package.json");
  if (pkg) {
    const script = (name: string) => {
      try {
        return (JSON.parse(pkg.content) as { scripts?: Record<string, string> }).scripts?.[name] ?? null;
      } catch {
        // Clipped or odd JSON: find the script by hand.
        return pkg.content.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))?.[1] ?? null;
      }
    };
    const pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lockb") || has("bun.lock") ? "bun" : "npm";
    const install = {
      pnpm: "corepack enable && (pnpm install --frozen-lockfile || pnpm install)",
      yarn: "corepack enable && yarn install",
      bun: "npm install -g bun --silent && bun install",
      npm: has("package-lock.json") ? "npm ci || npm install" : "npm install",
    }[pm];
    const steps: PlanStep[] = [{ command: install, timeoutSec: 360, stopOnFail: true }];
    const build = script("build");
    if (build) steps.push({ command: `${pm} run build`, timeoutSec: 300, stopOnFail: false });
    const test = script("test");
    if (test && !/no test specified/i.test(test)) steps.push({ command: `${pm} test`, timeoutSec: 300, stopOnFail: false });
    return { steps, stack: `Node (${pm})` };
  }
  if (has("requirements.txt") || has("pyproject.toml") || has("setup.py")) {
    const venv =
      "(python3 -m venv /work/venv 2>/dev/null || (apt-get update -qq && apt-get install -y -qq python3-venv >/dev/null && python3 -m venv /work/venv)) && . /work/venv/bin/activate";
    const install = has("requirements.txt") ? "pip install -q -r requirements.txt" : "pip install -q -e .";
    const steps: PlanStep[] = [{ command: `${venv} && ${install}`, timeoutSec: 420, stopOnFail: true }];
    if (snap.files.some((f) => /(^|\/)(tests?\/|test_[^/]*\.py$|[^/]*_test\.py$)/.test(f))) {
      steps.push({ command: ". /work/venv/bin/activate && pip install -q pytest && pytest -q -x --maxfail=5", timeoutSec: 300, stopOnFail: false });
    }
    return { steps, stack: "Python" };
  }
  return { steps: [], stack: snap.extensions.map(([e]) => e).slice(0, 3).join(", ") || "unknown" };
}

export function commandOutput(r: CommandResult, n = 2500) {
  const out = r.stdout.trim();
  const err = r.stderr.trim();
  return [out && `stdout (end):\n${tail(out, n)}`, err && `stderr (end):\n${tail(err, n)}`].filter(Boolean).join("\n") || "(no output)";
}

async function runPlan(ctx: CollectContext, out: Collected, snap: RepoSnapshot) {
  const { rec, criterion } = ctx;
  const skip = (why: string) => {
    rec.add({ kind: "note", mechanism: "sandbox_run", title: `Didn't run the code: ${why}` });
    out.sections.push({
      order: 2,
      title: "Sandbox run",
      text: `Not run: ${why}. Judge the code from reading it, and lower confidence on anything that needs it to run.`,
    });
  };
  const status = sandboxStatus();
  if (!status.ok) return skip(status.reason);

  rec.doing(`Cloning ${snap.repo.webUrl} in ${sandboxLabel()}`);
  const cloneStarted = Date.now();
  let base: RepoSandbox;
  try {
    base = await snap.clone();
  } catch (e) {
    return skip(`couldn't clone the repo into a sandbox (${message(e)})`);
  }
  rec.add({ kind: "mechanism", mechanism: "sandbox_run", title: `Cloned ${snap.repo.webUrl} in ${sandboxLabel()}`, ms: Date.now() - cloneStarted, ok: true });
  // This step's own branch: its installs don't leak into another step's.
  const sandbox = base.fork();
  out.sandbox = sandbox;
  const custom = criterion.sandboxCommands
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 8);
  const plan = custom.length
    ? { steps: custom.map((command) => ({ command, timeoutSec: 300, stopOnFail: false })), stack: "" }
    : autoPlan(snap);
  if (plan.steps.length === 0) {
    rec.add({ kind: "note", mechanism: "sandbox_run", title: `No install, build or test steps found for this stack (${plan.stack})` });
    out.sections.push({
      order: 2,
      title: "Sandbox run",
      text: `Didn't find install, build or test steps for this stack (${plan.stack}). The investigation can still run commands.`,
    });
    return;
  }

  const lines: string[] = [];
  for (const step of plan.steps) {
    rec.doing(`Sandbox: ${step.command}`);
    try {
      const r = await sandbox.run({ command: step.command, timeoutSec: step.timeoutSec, abortSignal: ctx.signal });
      const ok = r.exitCode === 0;
      rec.add({
        kind: "command",
        mechanism: "sandbox_run",
        title: `$ ${step.command} → exit ${r.exitCode}${r.timedOut ? " (timed out)" : ""}`,
        detail: commandOutput(r, 1800),
        ms: Math.round(r.seconds * 1000),
        ok,
      });
      lines.push(`$ ${step.command}\nexit ${r.exitCode}${r.timedOut ? " (timed out)" : ""} after ${r.seconds}s\n${commandOutput(r)}`);
      if (!ok && step.stopOnFail) {
        lines.push("(Stopped: the steps after this one need it to succeed.)");
        break;
      }
    } catch (e) {
      rec.add({ kind: "error", mechanism: "sandbox_run", title: `$ ${step.command} couldn't run`, detail: message(e), ok: false });
      lines.push(`$ ${step.command}\ncouldn't run: ${message(e)}`);
      break;
    }
  }
  out.sections.push({
    order: 2,
    title: "Sandbox run",
    text: `Ran in ${sandboxLabel()} (Linux, Node, python3) on a fresh clone, ${
      custom.length ? "with the organizer's commands" : `with commands picked from the repo (${plan.stack})`
    }. A failure can be the project's fault or the environment's (missing API keys, services, system packages): say which it looks like.\n\n${lines.join("\n\n")}`,
  });
}

// ── Web pages ─────────────────────────────────────────────────────────────

const focusOf = (ctx: CollectContext) =>
  [ctx.criterion.title, ctx.criterion.description, ...ctx.guidance.map((g) => g.text)].filter(Boolean).join(". ");

async function collectPages(ctx: CollectContext, out: Collected) {
  const { rec } = ctx;
  const links = ctx.inputs.pages.slice(0, 3);
  if (links.length === 0) {
    out.sections.push({ order: 3, title: "Web pages", text: "No links to visit in this criterion's inputs." });
    return;
  }
  rec.doing(`Visiting ${links.map((l) => host(l.url)).join(", ")}`);
  const started = Date.now();
  const [checks, pages] = await Promise.all([
    Promise.all(links.map((l) => checkLink(l.url, ctx.signal))),
    readPages(
      links.map((l) => l.url),
      { focus: focusOf(ctx), deep: ctx.tier === "deep" },
    ),
  ]);
  out.pages.push(...pages);

  links.forEach((link, i) => {
    const check = checks[i];
    const page = pages[i];
    const status = check.ok ? `loads (HTTP ${check.status}, ${check.ms}ms)` : `didn't load for us (${check.error ?? `HTTP ${check.status}`})`;
    rec.add({
      kind: "mechanism",
      mechanism: "web_scraper",
      title: `${page.ok ? "Read" : "Couldn't read"} ${link.url}`,
      detail: [`Link ${status}`, page.ok ? clip(page.content ?? "", 1200) : page.error].filter(Boolean).join("\n"),
      url: link.url,
      ok: page.ok || check.ok,
      ms: Date.now() - started,
    });
    if (!page.ok && !check.ok) out.flags.push({ kind: "broken_link", note: `"${link.block.title}" (${link.url}) didn't load` });
    out.sections.push({
      order: 3,
      title: `${link.block.title}: ${link.url}`,
      text: [`The link ${status}.`, page.ok ? `Title: ${page.title ?? "—"}\n${page.content}` : `Couldn't read the page: ${page.error}`].join("\n"),
    });
  });

  // In depth, follow the site a little further, steered by the organizer's guidance.
  const first = pages.find((p) => p.ok);
  if (ctx.tier === "deep" && first) {
    rec.doing(`Crawling ${host(first.url)}`);
    const crawlStarted = Date.now();
    const instructions = ctx.guidance.map((g) => g.text).join(" ") || `Pages that show ${ctx.criterion.title.toLowerCase()}`;
    const crawl = await crawlSite(first.url, { instructions, limit: 5 });
    const extra = crawl.pages.filter((p) => !pages.some((q) => q.url === p.url));
    rec.add({
      kind: "mechanism",
      mechanism: "web_scraper",
      title: crawl.ok ? `Crawled ${host(first.url)}: ${extra.length} more pages` : `Couldn't crawl ${host(first.url)}`,
      detail: crawl.ok ? extra.map((p) => p.url).join("\n") : crawl.error,
      ok: crawl.ok,
      ms: Date.now() - crawlStarted,
    });
    out.pages.push(...extra);
    if (extra.length) {
      out.sections.push({
        order: 4,
        title: `More pages on ${host(first.url)}`,
        text: extra.map((p) => `--- ${p.url} ---\n${clip(p.content ?? "", 2500)}`).join("\n"),
      });
    }
  }
}

// ── Video ─────────────────────────────────────────────────────────────────

async function collectVideo(ctx: CollectContext, out: Collected) {
  const { rec, criterion } = ctx;
  const link = ctx.inputs.videos[0];
  if (!link) {
    out.sections.push({ order: 5, title: "Video", text: "No video link in this criterion's inputs." });
    return;
  }
  rec.doing("Getting the video's details and transcript");
  const started = Date.now();
  const v = await ctx.resources.once(`video:${link.url}`, () => inspectVideo(link.url));
  out.video = v;
  const loaded = Boolean(v.title || v.transcript || v.durationSec);
  rec.add({
    kind: "mechanism",
    mechanism: "video_reviewer",
    title: loaded
      ? `${v.title ? `"${v.title}"` : link.url}${v.durationSec !== null ? ` · ${formatTime(v.durationSec)}` : ""} · ${v.transcript ? "transcript read" : "no transcript"}`
      : `Couldn't load ${link.url}`,
    detail: [v.transcriptNote, ...v.notes, v.transcript ? clip(v.transcript, 1500) : ""].filter(Boolean).join("\n"),
    url: link.url,
    ok: loaded,
    ms: Date.now() - started,
  });
  if (!loaded) out.flags.push({ kind: "broken_link", note: `The video (${link.url}) couldn't be loaded` });
  out.sections.push({ order: 5, title: "Video", text: describeVideo(v, link.block.expected) });

  if (v.frames.length) {
    rec.doing(`Looking at the video's frames with ${visionModelId(ctx.tier)}`);
    const framesStarted = Date.now();
    try {
      const { model, seen, usage } = await viewImages(v.frames, {
        focus: `${criterion.title}: ${criterion.description} These are the thumbnail and frames from through the project's demo video. Is a real, working product on screen, or slides, a talking head, or a mockup?`,
        tier: ctx.tier,
        signal: ctx.signal,
      });
      rec.addUsage(usage);
      rec.add({
        kind: "mechanism",
        mechanism: "video_reviewer",
        title: `Looked at ${seen.filter((s) => !s.error).length} of ${v.frames.length} video frames with ${model}`,
        detail: describeImages(seen),
        ms: Date.now() - framesStarted,
        ok: true,
      });
      out.sections.push({ order: 6, title: `Video frames (described by ${model})`, text: describeImages(seen) });
    } catch (e) {
      rec.add({ kind: "error", mechanism: "video_reviewer", title: "Couldn't look at the video's frames", detail: message(e), ok: false });
    }
  }
}
