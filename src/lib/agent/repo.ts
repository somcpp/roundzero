import { gunzipSync } from "node:zlib";
import { clip, USER_AGENT, withTimeout } from "./fetch";
import { cloneRepo, grepImage, readImageFile, sandboxLabel, sandboxStatus, type GrepHit, type RepoSandbox } from "./sandbox";

// What the agent knows about a project's repo. It's read from the host's
// tarball: every text file lands in memory, so searching the whole repo takes
// milliseconds and needs no API quota. A Nebius sandbox clone is made only
// when a step runs code (and stands in for the tarball on very large repos).

export type RepoRef = {
  host: string;
  owner: string;
  name: string;
  cloneUrl: string;
  webUrl: string;
  /** Branch, tag or commit from a /tree/<ref> link. */
  ref: string | null;
  /** Folder from a /tree/<ref>/<path> link, for monorepos. */
  subdir: string | null;
};

const HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"]);

export function parseRepoUrl(raw: string): RepoRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!HOSTS.has(host)) return null;
  const [owner, rawName, ...rest] = u.pathname.split("/").filter(Boolean);
  const name = rawName?.replace(/\.git$/, "");
  if (!owner || !name || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;

  // github: /tree/<ref>/<path> or /blob/<ref>/<file>; gitlab adds a "-" segment first.
  let ref: string | null = null;
  let subdir: string | null = null;
  const at = rest[0] === "-" ? 1 : 0;
  if ((rest[at] === "tree" || rest[at] === "blob") && rest[at + 1] && /^[\w./-]+$/.test(rest[at + 1])) {
    ref = rest[at + 1];
    const path = rest.slice(at + 2);
    if (rest[at] === "blob") path.pop();
    subdir = path.filter((p) => /^[\w.-]+$/.test(p) && p !== "..").join("/") || null;
  }
  return { host, owner, name, cloneUrl: `https://${host}/${owner}/${name}.git`, webUrl: `https://${host}/${owner}/${name}`, ref, subdir };
}

export type Commit = { sha: string; date: string; author: string; message: string };

export type RepoSnapshot = {
  repo: RepoRef;
  via: "archive" | "sandbox";
  fileCount: number;
  /** Every path relative to the repo (or its subdir). */
  files: string[];
  /** Text files by path, when read from the tarball. */
  text: Map<string, string> | null;
  /** Most common file extensions: a rough language mix. */
  extensions: [string, number][];
  manifests: { path: string; content: string }[];
  readme: { path: string; content: string } | null;
  commits: Commit[];
  totalCommits: number | null;
  notes: string[];
  seconds: number;
  /** The repo cloned in a Nebius sandbox: made on first call, shared by the project's steps. */
  clone: () => Promise<RepoSandbox>;
  /** Set when the snapshot itself came from a sandbox clone. */
  cloned: RepoSandbox | null;
};

const MANIFESTS = new Set([
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "deno.json",
  "Dockerfile",
  "docker-compose.yml",
  "compose.yaml",
  ".env.example",
]);
const MAX_MANIFEST = 6000;
const IGNORED_DIR = /(^|\/)(node_modules|vendor|dist|build|\.next|\.git|__pycache__|\.venv|venv)\//;

function pickManifests(files: string[]) {
  const depth = (p: string) => p.split("/").length;
  return files
    .filter((f) => MANIFESTS.has(f.split("/").pop()!) && !IGNORED_DIR.test(f))
    .sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))
    .slice(0, 8);
}

const pickReadme = (files: string[]) =>
  files
    .filter((f) => /^readme(\.(md|mdx|rst|txt))?$/i.test(f.split("/").pop()!))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];

function extensionMix(files: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const f of files) {
    if (IGNORED_DIR.test(f)) continue;
    const name = f.split("/").pop()!;
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : name;
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Clone on first use, then share the clone. */
function lazyClone(repo: RepoRef, existing: RepoSandbox | null) {
  let p: Promise<RepoSandbox> | null = existing ? Promise.resolve(existing) : null;
  return () => {
    const status = sandboxStatus();
    if (!status.ok) return Promise.reject(new Error(status.reason));
    p ??= cloneRepo(repo).then((r) => r.sandbox);
    p.catch(() => (p = null));
    return p;
  };
}

/** Look at a repo. Throws when there's no way in (missing, private, unreadable). */
export async function snapshotRepo(repo: RepoRef, signal?: AbortSignal): Promise<RepoSnapshot> {
  try {
    return await snapshotFromArchive(repo, signal);
  } catch (e) {
    if (!(e instanceof TooLarge) || !sandboxStatus().ok) throw e;
    return snapshotInSandbox(repo, [`${e.message} Read it from a sandbox clone instead.`], signal);
  }
}

// ── From the tarball ──────────────────────────────────────────────────────

class TooLarge extends Error {}

const MAX_ARCHIVE = 30_000_000;
const MAX_UNPACKED = 200_000_000;
const MAX_TEXT_FILE = 400_000;
const MAX_TEXT_TOTAL = 40_000_000;
const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|class|so|dylib|dll|exe|bin|wasm|woff2?|ttf|otf|eot|mp[34]|mov|avi|webm|ogg|wav|flac|sqlite|db|pkl|pt|onnx|h5|parquet|npy|lockb)$/i;

function archiveUrl(r: RepoRef) {
  const ref = r.ref ?? "HEAD";
  switch (r.host) {
    case "github.com":
      return `https://codeload.github.com/${r.owner}/${r.name}/tar.gz/${encodeURIComponent(ref)}`;
    case "gitlab.com":
      return `https://gitlab.com/${r.owner}/${r.name}/-/archive/${encodeURIComponent(ref)}/${r.name}-${encodeURIComponent(ref)}.tar.gz`;
    case "bitbucket.org":
      return `https://bitbucket.org/${r.owner}/${r.name}/get/${encodeURIComponent(ref)}.tar.gz`;
    default:
      return `https://${r.host}/${r.owner}/${r.name}/archive/${encodeURIComponent(ref)}.tar.gz`;
  }
}

const cString = (b: Buffer, start: number, len: number) => {
  const s = b.subarray(start, start + len);
  const end = s.indexOf(0);
  return s.subarray(0, end === -1 ? s.length : end).toString("utf8");
};

/** "len key=value\n" records of a pax header. */
function paxRecords(data: Buffer) {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    const space = data.indexOf(0x20, i);
    if (space === -1) break;
    const len = Number(data.subarray(i, space).toString());
    if (!len) break;
    const record = data.subarray(space + 1, i + len - 1).toString("utf8");
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

/** Regular files in a tar archive (ustar, pax and GNU long names). */
function* untar(buf: Buffer): Generator<{ path: string; data: Buffer }> {
  let offset = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header[0] === 0) break;
    const name = cString(header, 0, 100);
    const size = parseInt(cString(header, 124, 12).trim() || "0", 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const prefix = cString(header, 345, 155);
    const start = offset + 512;
    const data = buf.subarray(start, start + size);
    offset = start + Math.ceil(size / 512) * 512;
    if (type === "L") longName = data.toString("utf8").replace(/\0+$/, "");
    else if (type === "x") paxPath = paxRecords(data).path ?? null;
    else if (type === "0" || type === "7") {
      const path = paxPath ?? longName ?? (prefix ? `${prefix}/${name}` : name);
      paxPath = longName = null;
      yield { path, data };
    } else if (type !== "g") paxPath = longName = null;
  }
}

async function snapshotFromArchive(repo: RepoRef, signal?: AbortSignal): Promise<RepoSnapshot> {
  const started = Date.now();
  const notes: string[] = [];
  const res = await fetch(archiveUrl(repo), {
    headers: { "user-agent": USER_AGENT },
    signal: withTimeout(60_000, signal),
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 401 || res.status === 403) throw new Error("The repo doesn't exist or isn't public.");
  if (!res.ok) throw new Error(`Couldn't download the repo (HTTP ${res.status}).`);
  const size = Number(res.headers.get("content-length"));
  if (size > MAX_ARCHIVE) {
    await res.body?.cancel();
    throw new TooLarge(`The repo is too big to download (${Math.round(size / 1e6)} MB).`);
  }
  const gz = Buffer.from(await res.arrayBuffer());
  if (gz.length > MAX_ARCHIVE) throw new TooLarge(`The repo is too big to download (${Math.round(gz.length / 1e6)} MB).`);
  let tar: Buffer;
  try {
    tar = gunzipSync(gz, { maxOutputLength: MAX_UNPACKED });
  } catch (e) {
    throw /maxOutputLength|buffer/i.test(message(e)) ? new TooLarge("The repo is too big to unpack.") : e;
  }

  // Archives nest everything under one folder ("repo-sha/"); drop it, then the subdir.
  const sub = repo.subdir ? `${repo.subdir.replace(/\/+$/, "")}/` : "";
  const files: string[] = [];
  const text = new Map<string, string>();
  let textBytes = 0;
  let skipped = 0;
  for (const entry of untar(tar)) {
    const rel = entry.path.split("/").slice(1).join("/");
    if (!rel || !rel.startsWith(sub)) continue;
    const path = rel.slice(sub.length);
    files.push(path);
    if (BINARY.test(path) || entry.data.length > MAX_TEXT_FILE || IGNORED_DIR.test(path)) continue;
    if (entry.data.subarray(0, 8000).includes(0)) continue;
    if (textBytes + entry.data.length > MAX_TEXT_TOTAL) {
      skipped++;
      continue;
    }
    text.set(path, entry.data.toString("utf8"));
    textBytes += entry.data.length;
  }
  if (files.length === 0) throw new Error(sub ? `There's no folder ${repo.subdir} in the repo.` : "The repo is empty.");
  if (skipped) notes.push(`${skipped} text files weren't loaded: the repo has more text than the agent reads (${MAX_TEXT_TOTAL / 1e6} MB).`);

  const read = (path: string) => {
    const content = text.get(path);
    return content === undefined ? null : { path, content: clip(content, MAX_MANIFEST) };
  };
  const readmePath = pickReadme(files);
  const { commits, total } = await recentCommits(repo, signal).catch((e) => {
    notes.push(`Commit history unavailable: ${message(e)}`);
    return { commits: [] as Commit[], total: null };
  });

  return {
    repo,
    via: "archive",
    fileCount: files.length,
    files,
    text,
    extensions: extensionMix(files),
    manifests: pickManifests(files)
      .map(read)
      .filter((m) => m !== null),
    readme: readmePath ? read(readmePath) : null,
    commits,
    totalCommits: total,
    notes,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    clone: lazyClone(repo, null),
    cloned: null,
  };
}

/** The latest commits, from the host's API (GitHub, GitLab or Codeberg). */
async function recentCommits(repo: RepoRef, signal?: AbortSignal): Promise<{ commits: Commit[]; total: number | null }> {
  const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/json" };
  let url: string;
  if (repo.host === "github.com") {
    url = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=40${repo.ref ? `&sha=${encodeURIComponent(repo.ref)}` : ""}`;
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  } else if (repo.host === "gitlab.com") {
    url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${repo.owner}/${repo.name}`)}/repository/commits?per_page=40${repo.ref ? `&ref_name=${encodeURIComponent(repo.ref)}` : ""}`;
  } else if (repo.host === "codeberg.org") {
    url = `https://codeberg.org/api/v1/repos/${repo.owner}/${repo.name}/commits?limit=40${repo.ref ? `&sha=${encodeURIComponent(repo.ref)}` : ""}`;
  } else {
    return { commits: [], total: null };
  }
  const res = await fetch(url, { headers, signal: withTimeout(15_000, signal), cache: "no-store" });
  if (res.status === 403 || res.status === 429) throw new Error("rate limited (set GITHUB_TOKEN to raise GitHub's limit)");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  const commits = rows.map((c) => {
    const gh = c.commit as { message?: string; author?: { name?: string; date?: string } } | undefined;
    return {
      sha: String(c.sha ?? c.id ?? "").slice(0, 7),
      date: String(gh?.author?.date ?? c.committed_date ?? c.created_at ?? ""),
      author: String(gh?.author?.name ?? c.author_name ?? ""),
      message: String(gh?.message ?? c.title ?? c.message ?? "").split("\n")[0],
    };
  });
  return { commits, total: null };
}

// ── From a sandbox clone (repos too big to download) ──────────────────────

async function snapshotInSandbox(repo: RepoRef, notes: string[], signal?: AbortSignal): Promise<RepoSnapshot> {
  const started = Date.now();
  const { sandbox } = await cloneRepo(repo, signal);
  const scope = repo.subdir ? `-- "$SUBDIR"` : "";
  const info = await sandbox.peek(
    [
      "cd /work/repo",
      `echo "@@count $(git ls-files ${scope} | wc -l)"`,
      'echo "@@commits $(git rev-list --count HEAD)"',
      'echo "@@files"',
      `git ls-files ${scope} | head -n 5000`,
      'echo "@@log"',
      "git log --date=iso-strict --format='%h|%ad|%an|%s' -n 40",
    ].join("\n"),
    signal,
    repo.subdir ? { SUBDIR: repo.subdir } : undefined,
  );
  const sections = new Map<string, string[]>();
  let current = "";
  let fileCount = 0;
  let totalCommits: number | null = null;
  for (const line of info.stdout.split("\n")) {
    if (line.startsWith("@@count ")) fileCount = Number(line.slice(8)) || 0;
    else if (line.startsWith("@@commits ")) totalCommits = Number(line.slice(10)) || null;
    else if (line.startsWith("@@")) current = line.slice(2);
    else if (line.trim()) sections.set(current, [...(sections.get(current) ?? []), line]);
  }
  const prefix = repo.subdir ? `${repo.subdir.replace(/\/+$/, "")}/` : "";
  const files = (sections.get("files") ?? []).map((f) => (prefix && f.startsWith(prefix) ? f.slice(prefix.length) : f));
  const commits = (sections.get("log") ?? []).map((l) => {
    const [sha, date, author, ...msg] = l.split("|");
    return { sha, date, author, message: msg.join("|") };
  });
  const read = async (path: string) => {
    const content = await readImageFile(sandbox.image, `${sandbox.root}/${path}`, signal).catch(() => null);
    return content === null ? null : { path, content: clip(content, MAX_MANIFEST) };
  };
  const readmePath = pickReadme(files);
  const [manifests, readme] = await Promise.all([
    Promise.all(pickManifests(files).map(read)),
    readmePath ? read(readmePath) : Promise.resolve(null),
  ]);
  return {
    repo,
    via: "sandbox",
    fileCount: fileCount || files.length,
    files,
    text: null,
    extensions: extensionMix(files),
    manifests: manifests.filter((m) => m !== null),
    readme,
    commits,
    totalCommits,
    notes,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    clone: lazyClone(repo, sandbox),
    cloned: sandbox,
  };
}

// ── Searching and reading ─────────────────────────────────────────────────

export const SEARCH_EXCLUDE = ["!**/node_modules/**", "!**/.git/**", "!**/dist/**", "!**/build/**", "!**/.next/**", "!**/vendor/**", "!**/*.min.js", "!**/*.map"];
const SKIP_SEARCH = /(^|\/)(node_modules|\.git|dist|build|\.next|vendor)\/|\.min\.js$|\.map$/;

const escapeRegex = (s: string) => s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

/** A regex from the model, or its literal text when it looks like it could backtrack forever. */
export function safeRegex(pattern: string) {
  const risky = /\([^)]*[+*][^)]*\)[+*{]/.test(pattern);
  try {
    return new RegExp(risky ? escapeRegex(pattern) : pattern, /[A-Z]/.test(pattern) ? "" : "i");
  } catch {
    return new RegExp(escapeRegex(pattern), "i");
  }
}

/** Matching lines across the repo's text files (in memory), up to `max`. */
export function grepText(snap: RepoSnapshot, re: RegExp, { max = 50, perFile = 5, glob }: { max?: number; perFile?: number; glob?: RegExp } = {}) {
  const hits: GrepHit[] = [];
  let truncated = false;
  for (const [path, content] of snap.text ?? []) {
    if (SKIP_SEARCH.test(path) || (glob && !glob.test(path))) continue;
    let inFile = 0;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length && inFile < perFile; i++) {
      const line = lines[i].length > 1000 ? lines[i].slice(0, 1000) : lines[i];
      if (!re.test(line)) continue;
      if (hits.length >= max) {
        truncated = true;
        break;
      }
      hits.push({ path, line: i + 1, text: line.trim().slice(0, 300) });
      inFile++;
    }
    if (truncated) break;
  }
  return { hits, truncated };
}

/** A shell glob like "*.ts" or "src/**" as a path regex. */
export function globRegex(glob: string) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/?/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0000/g, ".*");
  return new RegExp(glob.includes("/") ? `^${re}$` : `(^|/)${re}$`);
}

export type RepoSearch = { target: string; hits: GrepHit[]; truncated: boolean };

/** Where each target shows up in the whole repo (case-insensitive, literal). */
export async function searchRepo(snap: RepoSnapshot, targets: string[], signal?: AbortSignal): Promise<RepoSearch[]> {
  if (snap.text) {
    return targets.map((target) => ({ target, ...grepText(snap, new RegExp(escapeRegex(target), "i"), { max: 40, perFile: 3 }) }));
  }
  const sandbox = snap.cloned!;
  return Promise.all(
    targets.map(async (target) => {
      const { hits, truncated } = await grepImage(sandbox.image, {
        patterns: [escapeRegex(target)],
        paths: [sandbox.root],
        globs: SEARCH_EXCLUDE,
        caseMode: "insensitive",
        maxTotal: 40,
        maxCount: 3,
        signal,
      });
      return { target, hits: hits.map((h) => ({ ...h, path: h.path.replace(`${sandbox.root}/`, "") })), truncated };
    }),
  );
}

/** A readable summary of the snapshot for the judge. */
export function describeRepo(snap: RepoSnapshot) {
  const { repo } = snap;
  const lines = [
    `Repo: ${repo.webUrl}${repo.ref ? ` @ ${repo.ref}` : ""}${repo.subdir ? ` (folder ${repo.subdir})` : ""}, read ${
      snap.via === "archive" ? "from its source archive" : `from a clone in ${sandboxLabel()}`
    }.`,
    `${snap.fileCount} files. Mix: ${snap.extensions.map(([ext, n]) => `${ext} ${n}`).join(", ") || "—"}.`,
  ];
  if (snap.commits.length) {
    const newest = snap.commits[0];
    const oldest = snap.commits[snap.commits.length - 1];
    lines.push(
      `Commits: ${snap.totalCommits ?? `${snap.commits.length}${snap.commits.length >= 40 ? "+" : ""}`}. Latest ${newest.date}; oldest shown ${oldest.date}.`,
      ...snap.commits.slice(0, 15).map((c) => `  ${c.sha} ${c.date.slice(0, 16)} ${c.author}: ${clip(c.message, 100)}`),
    );
  }
  const shown = snap.files.filter((f) => !IGNORED_DIR.test(f));
  lines.push("Files:", ...shown.slice(0, 150).map((f) => `  ${f}`));
  if (shown.length > 150) lines.push(`  …and ${shown.length - 150} more`);
  for (const m of snap.manifests) lines.push(`--- ${m.path} ---`, clip(m.content, 2500));
  if (snap.readme) lines.push(`--- ${snap.readme.path} ---`, clip(snap.readme.content, 5000));
  return lines.join("\n");
}
