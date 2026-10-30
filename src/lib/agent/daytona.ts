// Daytona sandboxes (https://www.daytona.io/docs): long-lived Linux VMs where
// state carries over between commands, the way a laptop's would. Unlike Nebius
// there are no per-command images, so a project's steps share one sandbox and
// take turns running commands (see RepoSandbox in ./sandbox). Sandboxes are
// ephemeral: they stop after a few idle minutes and are deleted when they stop,
// so a crashed or timed-out review never leaves one running.

import { Daytona, type Sandbox } from "@daytonaio/sdk";

/** A handle that stands in for a Nebius image id wherever the agent passes one around. */
export const HANDLE_PREFIX = "daytona:";
export const isDaytonaHandle = (image: string) => image.startsWith(HANDLE_PREFIX);
const handle = (sandbox: Sandbox) => `${HANDLE_PREFIX}${sandbox.id}`;

/** Minutes without activity before a sandbox stops (and, being ephemeral, is deleted). */
const IDLE_MINUTES = 15;

export const daytonaConfigured = () => Boolean(process.env.DAYTONA_API_KEY);

let client: Daytona | null = null;
const daytona = () => (client ??= new Daytona({ apiKey: process.env.DAYTONA_API_KEY }));

// Sandboxes this server process has open, so each command doesn't refetch one.
const open = new Map<string, Promise<Sandbox>>();

function sandboxFor(image: string): Promise<Sandbox> {
  const id = image.slice(HANDLE_PREFIX.length);
  let p = open.get(id);
  if (!p) {
    p = daytona().get(id);
    p.catch(() => open.delete(id));
    open.set(id, p);
  }
  return p;
}

export type DaytonaRun = { exitCode: number; output: string; timedOut: boolean; seconds: number };

/** Run a shell command in a sandbox. The command's own timeout is enforced by Daytona. */
export async function daytonaExec(
  image: string,
  { command, cwd, env, timeoutSec }: { command: string; cwd?: string; env?: Record<string, string>; timeoutSec: number },
): Promise<DaytonaRun> {
  const sandbox = await sandboxFor(image);
  const started = Date.now();
  try {
    // bash -c so pipes, &&, set -e and "$VARS" behave as in the Nebius sandboxes.
    const r = await sandbox.process.executeCommand(
      `bash -c ${shellQuote(command)}`,
      cwd,
      { GIT_TERMINAL_PROMPT: "0", CI: "1", ...env },
      timeoutSec,
    );
    return { exitCode: r.exitCode, output: r.result ?? "", timedOut: false, seconds: elapsed(started) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/timeout|timed out|deadline/i.test(message)) return { exitCode: 124, output: message, timedOut: true, seconds: elapsed(started) };
    throw e;
  }
}

/** Make a sandbox and clone the repo into it. Returns the handle and git's `HEAD date` line. */
export async function daytonaClone(
  repo: { cloneUrl: string; ref: string | null },
  root: string,
  signal?: AbortSignal,
): Promise<{ image: string; run: DaytonaRun }> {
  const sandbox = await daytona().create(
    {
      language: "typescript",
      ephemeral: true,
      autoStopInterval: IDLE_MINUTES,
      labels: { app: "roundzero", purpose: "judge-repo" },
    },
    { timeout: 120 },
  );
  const image = handle(sandbox);
  open.set(sandbox.id, Promise.resolve(sandbox));
  if (signal?.aborted) {
    await daytonaDelete(image);
    throw signal.reason;
  }
  // The URL and ref go in as env vars, never spliced into the command.
  const command = [
    "set -e",
    `rm -rf ${root} && mkdir -p $(dirname ${root})`,
    `git clone --filter=blob:none --no-tags --quiet "$REPO_URL" ${root}`,
    `cd ${root}`,
    'if [ -n "$REPO_REF" ]; then git checkout --quiet "$REPO_REF"; fi',
    "git log -1 --format='%H %cI'",
  ].join("\n");
  const run = await daytonaExec(image, { command, env: { REPO_URL: repo.cloneUrl, REPO_REF: repo.ref ?? "" }, timeoutSec: 240 });
  if (run.exitCode !== 0) await daytonaDelete(image);
  return { image, run };
}

/** Delete a sandbox now rather than waiting for it to go idle. */
export async function daytonaDelete(image: string) {
  const id = image.slice(HANDLE_PREFIX.length);
  const p = open.get(id);
  open.delete(id);
  await (p ?? daytona().get(id)).then((s) => s.delete()).catch(() => {});
}

/** A text file from a sandbox, or null when it isn't there. */
export async function daytonaReadFile(image: string, path: string): Promise<string | null> {
  const sandbox = await sandboxFor(image);
  try {
    return (await sandbox.fs.downloadFile(path)).toString("utf8");
  } catch (e) {
    if (/not found|no such file|404|is a directory/i.test(e instanceof Error ? e.message : String(e))) return null;
    throw e;
  }
}

/** A directory's entries. */
export async function daytonaListDir(image: string, path: string) {
  const sandbox = await sandboxFor(image);
  const files = await sandbox.fs.listFiles(path);
  return files.map((f) => ({ name: f.name, dir: Boolean(f.isDir), size: f.size ?? 0 }));
}

/**
 * Search files for regexes with grep -P (Perl-compatible, close to the Rust
 * regexes the Nebius grep takes). Globs follow rg -g: "!" excludes.
 */
export async function daytonaGrep(
  image: string,
  {
    patterns,
    paths,
    globs,
    caseMode,
    maxTotal,
    maxCount,
  }: { patterns: string[]; paths: string[]; globs: string[]; caseMode: "sensitive" | "insensitive" | "smart"; maxTotal: number; maxCount: number },
): Promise<{ hits: { path: string; line: number; text: string }[]; truncated: boolean }> {
  // grep -P takes one pattern, so the regexes are joined as alternatives.
  const pattern = patterns.map((p) => `(?:${p})`).join("|");
  const insensitive = caseMode === "insensitive" || (caseMode === "smart" && !/[A-Z]/.test(patterns.join("")));
  const env: Record<string, string> = { GREP_PATTERN: pattern };
  const args: string[] = [];
  globs.forEach((g, i) => {
    const negate = g.startsWith("!");
    const glob = negate ? g.slice(1) : g;
    env[`GLOB_${i}`] = glob.replace(/^\*\*\//, "").replace(/\/\*\*$/, "");
    // A glob without a dot or wildcard names a directory, like rg's "!node_modules".
    const isDir = !/[.*?]/.test(glob) || glob.endsWith("/**");
    args.push(negate ? (isDir ? `--exclude-dir="$GLOB_${i}"` : `--exclude="$GLOB_${i}"`) : `--include="$GLOB_${i}"`);
  });
  paths.forEach((p, i) => {
    env[`PATH_${i}`] = p;
  });
  const targets = paths.map((_, i) => `"$PATH_${i}"`).join(" ");
  const command =
    `grep -rnIP ${insensitive ? "-i" : ""} -m ${maxCount} --exclude-dir=.git --exclude-dir=node_modules ${args.join(" ")} ` +
    `-e "$GREP_PATTERN" ${targets} 2>/dev/null | head -n ${maxTotal + 1}`;
  const run = await daytonaExec(image, { command, env, timeoutSec: 60 });
  const lines = run.output.split("\n").filter(Boolean);
  const hits = lines.slice(0, maxTotal).flatMap((l) => {
    const m = l.match(/^(.*?):(\d+):(.*)$/);
    return m ? [{ path: m[1], line: Number(m[2]), text: m[3].trimEnd().slice(0, 300) }] : [];
  });
  return { hits, truncated: lines.length > maxTotal };
}

const elapsed = (started: number) => Math.round((Date.now() - started) / 100) / 10;

/** Single-quote a string for bash. */
const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
