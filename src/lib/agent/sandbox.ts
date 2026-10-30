// Nebius Sandboxes (Contree): VM-isolated containers where every command runs
// on an image and produces a new one, like a commit. A repo is cloned once,
// then each review step forks that image, so a step's installs and builds
// carry over between its own commands without touching another step's.
// Reading and grepping files goes through the inspect API, with no VM at all.
// https://docs.tokenfactory.nebius.com/sandboxes/overview

const BASE_URL = `${process.env.NEBIUS_SANDBOX_URL || "https://api.tokenfactory.nebius.com/sandboxes"}/v1`;
const projectId = () => process.env.NEBIUS_PROJECT_ID || process.env.NEBIUS_AI_PROJECT || "";

/** Whether sandboxes can run here, and why not. */
export function sandboxStatus(): { ok: true } | { ok: false; reason: string } {
  if (!process.env.NEBIUS) return { ok: false, reason: "NEBIUS isn't set" };
  if (!projectId()) return { ok: false, reason: "NEBIUS_PROJECT_ID isn't set" };
  return { ok: true };
}

export class SandboxError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | string[] | undefined>;

async function api<T>(
  path: string,
  { method, json, query, signal, text }: { method?: string; json?: unknown; query?: Query; signal?: AbortSignal; text?: boolean } = {},
): Promise<{ data: T; headers: Headers }> {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [String(v)]) url.searchParams.append(k, item);
  }
  const res = await fetch(url, {
    method: method ?? (json === undefined ? "GET" : "POST"),
    headers: {
      authorization: `Bearer ${process.env.NEBIUS}`,
      project: projectId(),
      accept: text ? "text/plain" : "application/json",
      ...(json === undefined ? {} : { "content-type": "application/json" }),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
    signal,
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    let reason = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      reason = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
    } catch {}
    throw new SandboxError(`Sandbox API ${res.status}: ${reason}`, res.status);
  }
  return { data: (text ? body : body ? JSON.parse(body) : null) as T, headers: res.headers };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

type Stream = { value: string; encoding: "ascii" | "base64"; truncated?: boolean };

type Operation = {
  uuid: string;
  status: "PENDING" | "ASSIGNED" | "EXECUTING" | "SUCCESS" | "FAILED" | "CANCELLED";
  error: string | null;
  result_image_uuid: string | null;
  metadata?: {
    result?: {
      state?: { exit_code?: number; timed_out?: boolean };
      stdout?: Stream;
      stderr?: Stream;
    };
  } | null;
  result?: { image?: string | null } | null;
};

const TERMINAL = new Set<Operation["status"]>(["SUCCESS", "FAILED", "CANCELLED"]);

/** Poll an operation until it finishes, following the server's Retry-After. Cancels it on timeout. */
async function waitFor(id: string, timeoutMs: number, signal?: AbortSignal): Promise<Operation> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data, headers } = await api<Operation>(`/operations/${id}`, { signal });
    if (TERMINAL.has(data.status)) return data;
    if (Date.now() > deadline || signal?.aborted) {
      await api(`/operations/${id}`, { method: "DELETE" }).catch(() => {});
      throw new SandboxError(signal?.aborted ? "Cancelled" : `Timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    const hint = Number(headers.get("retry-after"));
    await sleep(Math.min(5000, Math.max(1000, hint > 0 ? hint * 1000 : 1500)), signal);
  }
}

/** A new operation's id: in the body, or at the end of the Location header. */
function operationId(data: { uuid?: string } | null, headers: Headers) {
  const id = data?.uuid ?? headers.get("location")?.split("/").filter(Boolean).pop();
  if (!id) throw new SandboxError("The sandbox didn't say which operation it started");
  return id;
}

const decode = (s?: Stream) =>
  !s ? "" : s.encoding === "base64" ? Buffer.from(s.value, "base64").toString("utf8") : s.value;

export type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  seconds: number;
};

/**
 * Run a shell command on an image. With `persist`, the result is saved as a
 * new image (returned as `image`) that later commands can build on.
 */
export async function runInImage({
  image,
  command,
  cwd,
  env,
  timeoutSec = 120,
  persist = false,
  signal,
}: {
  image: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutSec?: number;
  persist?: boolean;
  signal?: AbortSignal;
}): Promise<CommandResult & { image: string | null }> {
  const started = Date.now();
  const { data, headers } = await api<{ uuid?: string }>("/instances", {
    json: {
      image,
      command,
      shell: true,
      cwd: cwd ?? "",
      // No prompts: a private repo should fail fast, not hang waiting for a password.
      env: { GIT_TERMINAL_PROMPT: "0", CI: "1", ...env },
      timeout: timeoutSec,
      disposable: !persist,
      truncate_output_at: 200_000,
    },
    signal,
  });
  // Boot and teardown on top of the command's own timeout.
  const op = await waitFor(operationId(data, headers), (timeoutSec + 90) * 1000, signal);
  const result = op.metadata?.result;
  if (!result?.state) throw new SandboxError(op.error || `The sandbox run ended ${op.status.toLowerCase()} before the command ran`);
  return {
    command,
    exitCode: result.state.exit_code ?? -1,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
    timedOut: Boolean(result.state.timed_out),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    image: op.status === "SUCCESS" ? op.result_image_uuid : null,
  };
}

// ── Base image ────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Debian with Node 22, git, curl and python3: covers most hackathon repos. */
const DEFAULT_SOURCE = "docker://docker.io/library/node:22-bookworm";

let baseImagePromise: Promise<string> | null = null;

/**
 * The image repos are cloned onto. NEBIUS_SANDBOX_IMAGE can name one by
 * UUID, by tag, or as a docker:// reference to import; by default node:22 is
 * imported once and tagged, and later runs find it by the tag.
 */
export function baseImage(): Promise<string> {
  baseImagePromise ??= resolveBaseImage().catch((e) => {
    baseImagePromise = null;
    throw e;
  });
  return baseImagePromise;
}

async function resolveBaseImage(): Promise<string> {
  const configured = process.env.NEBIUS_SANDBOX_IMAGE?.trim() ?? "";
  if (UUID.test(configured)) return configured;
  const source = configured.startsWith("docker://") ? configured : DEFAULT_SOURCE;
  const tag =
    configured && !configured.startsWith("docker://")
      ? configured.replace(/^tag:/, "")
      : `roundzero-judge:${source.split("/").pop()!.replace(/[^A-Za-z0-9_.-]/g, "-")}`;

  const { data } = await api<{ images?: { uuid: string; tag: string | null }[] }>("/images", {
    query: { tag, limit: 20 },
  });
  const found = data.images?.find((i) => i.tag === tag);
  if (found) return found.uuid;
  if (configured && !configured.startsWith("docker://")) throw new SandboxError(`No sandbox image is tagged ${tag}`);

  const imported = await api<{ uuid?: string }>("/images/import", {
    json: { registry: { url: source }, tag, timeout: 900 },
  });
  const op = await waitFor(operationId(imported.data, imported.headers), 16 * 60_000);
  const uuid = op.result?.image ?? op.result_image_uuid;
  if (op.status !== "SUCCESS" || !uuid) throw new SandboxError(`Couldn't prepare the sandbox image: ${op.error ?? op.status}`);
  return uuid;
}

// ── Reading an image without a VM ─────────────────────────────────────────

export type GrepHit = { path: string; line: number; text: string };

/** ripgrep over files in an image. Patterns are Rust regexes; globs follow rg -g ("!" negates). */
export async function grepImage(
  image: string,
  {
    patterns,
    paths,
    globs,
    caseMode = "smart",
    maxTotal = 200,
    maxCount = 5,
    signal,
  }: {
    patterns: string[];
    paths?: string[];
    globs?: string[];
    caseMode?: "sensitive" | "insensitive" | "smart";
    maxTotal?: number;
    maxCount?: number;
    signal?: AbortSignal;
  },
): Promise<{ hits: GrepHit[]; truncated: boolean }> {
  const { data } = await api<{
    matches: { path: string; line_number: number; line_text: string; type: "match" | "context" }[];
    truncated: boolean;
  }>(`/inspect/${image}/grep`, {
    query: { pattern: patterns, path: paths, glob: globs, case: caseMode, max_total: maxTotal, max_count: maxCount },
    signal,
  });
  return {
    hits: data.matches
      .filter((m) => m.type === "match")
      .map((m) => ({ path: m.path, line: m.line_number, text: m.line_text.trimEnd().slice(0, 300) })),
    truncated: data.truncated,
  };
}

/** A directory's entries in an image, directories first. */
export async function listImageDir(image: string, path: string, signal?: AbortSignal) {
  const { data } = await api<{ files: { path: string; is_dir: boolean; size: number }[] }>(`/inspect/${image}/list`, {
    query: { path },
    signal,
  });
  return data.files
    .map((f) => ({ name: f.path.split("/").filter(Boolean).pop() ?? f.path, dir: f.is_dir, size: f.size }))
    .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
}

/** A text file from an image, or null when it isn't there. */
export async function readImageFile(image: string, path: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const { data } = await api<string>(`/inspect/${image}/download`, { query: { path, text: "" }, text: true, signal });
    return data;
  } catch (e) {
    if (e instanceof SandboxError && (e.status === 404 || e.status === 422)) return null;
    throw e;
  }
}

// ── A repo in a sandbox ───────────────────────────────────────────────────

/**
 * A cloned repo the agent can run commands in. It chains images: each command
 * runs on the result of the last, so state carries over. `fork()` branches
 * from the current state.
 */
export class RepoSandbox {
  readonly log: CommandResult[] = [];

  constructor(
    public image: string,
    readonly root: string,
  ) {}

  get description() {
    return `A Linux VM (Debian bookworm, Node 22 with npm and corepack, git, curl, python3) with the repo cloned at ${this.root}. Commands run as root in ${this.root} with network access, and state carries over between commands.`;
  }

  fork() {
    return new RepoSandbox(this.image, this.root);
  }

  async run({
    command,
    workingDirectory,
    env,
    abortSignal,
    timeoutSec = 180,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
    timeoutSec?: number;
  }) {
    const result = await runInImage({
      image: this.image,
      command,
      cwd: workingDirectory ?? this.root,
      env,
      timeoutSec,
      persist: true,
      signal: abortSignal,
    });
    if (result.image) this.image = result.image;
    this.log.push(result);
    return result;
  }

  /** Run without saving any state: for looking around. */
  peek(command: string, signal?: AbortSignal, env?: Record<string, string>) {
    return runInImage({ image: this.image, command, cwd: this.root, env, timeoutSec: 60, signal });
  }
}

/** Clone a repo onto the base image. Throws with git's reason when it can't (missing, private…). */
export async function cloneRepo(
  repo: { cloneUrl: string; ref: string | null; subdir: string | null },
  signal?: AbortSignal,
): Promise<{ sandbox: RepoSandbox; head: string; seconds: number }> {
  const image = await baseImage();
  // The URL and ref go in as env vars, never spliced into the command.
  const command = [
    "set -e",
    'git clone --filter=blob:none --no-tags --quiet "$REPO_URL" /work/repo',
    "cd /work/repo",
    'if [ -n "$REPO_REF" ]; then git checkout --quiet "$REPO_REF"; fi',
    "git log -1 --format='%H %cI'",
  ].join("\n");
  const result = await runInImage({
    image,
    command,
    env: { REPO_URL: repo.cloneUrl, REPO_REF: repo.ref ?? "" },
    timeoutSec: 240,
    persist: true,
    signal,
  });
  if (result.exitCode !== 0 || !result.image) {
    const why = (result.stderr || result.stdout).trim().split("\n").slice(-3).join(" ");
    const hint = /not found|could not read|authentication|terminal prompts disabled/i.test(why)
      ? "The repo doesn't exist or isn't public."
      : result.timedOut
        ? "Cloning timed out."
        : "";
    throw new SandboxError(`Couldn't clone ${repo.cloneUrl}. ${hint} ${why}`.replace(/\s+/g, " ").trim());
  }
  const root = repo.subdir ? `/work/repo/${repo.subdir.replace(/^\/+|\/+$/g, "")}` : "/work/repo";
  return { sandbox: new RepoSandbox(result.image, root), head: result.stdout.trim(), seconds: result.seconds };
}
