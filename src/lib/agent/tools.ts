import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Mechanism, ModelTier } from "@/lib/data";
import { commandOutput, type Collected } from "./collect";
import { clip } from "./fetch";
import type { StepRecorder } from "./recorder";
import { globRegex, grepText, safeRegex, SEARCH_EXCLUDE } from "./repo";
import { grepImage, readImageFile } from "./sandbox";
import { formatTime } from "./video";
import { describeImages, viewImages } from "./vision";
import { readPages, searchWeb } from "./web";

// What the model can do while it investigates a criterion, depending on the
// criterion's mechanisms and what evidence collection turned up. Every call
// counts against the tier's budget and lands in the step's trace.

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A path relative to the repo, with ".." kept from climbing out of it. */
function repoPath(path: string) {
  const parts: string[] = [];
  for (const p of path.replace(/^\/+/, "").split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

export function investigationTools({
  collected,
  mechanisms,
  tier,
  budget,
  rec,
  signal,
}: {
  collected: Collected;
  mechanisms: Mechanism[];
  tier: ModelTier;
  budget: number;
  rec: StepRecorder;
  signal: AbortSignal;
}): { tools: ToolSet; notes: string[] } {
  let used = 0;
  const notes: string[] = [];

  /** Run one tool call inside the budget, recording it. */
  const call = async <T,>(title: string, fn: () => Promise<T>, summarize: (r: T) => string): Promise<T | { error: string }> => {
    if (used >= budget) return { error: "Tool budget used up. Write your findings now." };
    used++;
    rec.doing(title);
    const started = Date.now();
    try {
      const result = await fn();
      rec.add({ kind: "tool", title, detail: summarize(result), ms: Date.now() - started, ok: true });
      return result;
    } catch (e) {
      rec.add({ kind: "tool", title, detail: message(e), ms: Date.now() - started, ok: false });
      return { error: message(e) };
    }
  };

  const tools: ToolSet = {};
  const snap = collected.snapshot;
  /** Lines of each file already shown to the model, so a repeat read costs nothing. */
  const seen = new Map<string, [number, number][]>();

  if (snap) {
    const cloned = snap.cloned;
    tools.searchRepo = tool({
      description: `Search every file in the project's repo (${snap.repo.webUrl}) for a regex. Returns matching lines with paths and line numbers.`,
      inputSchema: z.object({
        pattern: z.string().min(1).max(300).describe("A regex, case-insensitive unless it has capitals; escape ( ) . etc. to match literally"),
        glob: z.string().max(100).optional().describe('Only files matching this glob, e.g. "*.py" or "src/**"'),
      }),
      execute: ({ pattern, glob }) =>
        call(
          `Searched the repo for /${pattern}/${glob ? ` in ${glob}` : ""}`,
          async () => {
            if (snap.text) {
              const { hits, truncated } = grepText(snap, safeRegex(pattern), { max: 50, glob: glob ? globRegex(glob) : undefined });
              return { matches: hits.map((h) => `${h.path}:${h.line}  ${h.text}`), truncated };
            }
            const { hits, truncated } = await grepImage(cloned!.image, {
              patterns: [pattern],
              paths: [cloned!.root],
              globs: [...SEARCH_EXCLUDE, ...(glob ? [glob] : [])],
              caseMode: "smart",
              maxTotal: 50,
              maxCount: 5,
              signal,
            });
            return { matches: hits.map((h) => `${h.path.replace(`${cloned!.root}/`, "")}:${h.line}  ${h.text}`), truncated };
          },
          (r) => `${r.matches.length}${r.truncated ? "+" : ""} matches\n${r.matches.slice(0, 20).join("\n")}`,
        ),
    });

    tools.readRepoFile = tool({
      description: "Read a file from the project's repo, optionally a range of lines.",
      inputSchema: z.object({
        path: z.string().min(1).max(300).describe("Path relative to the repo root, e.g. src/index.ts"),
        startLine: z.number().int().min(1).optional(),
        endLine: z.number().int().min(1).optional(),
      }),
      execute: ({ path, startLine, endLine }) =>
        call(
          `Read ${path}${startLine ? ` lines ${startLine}–${endLine ?? "end"}` : ""}`,
          async () => {
            const rel = repoPath(path);
            const text = snap.text
              ? (snap.text.get(rel) ?? null)
              : await readImageFile(cloned!.image, `${cloned!.root}/${rel}`, signal);
            if (text === null) {
              throw new Error(snap.files.includes(rel) ? `${rel} is binary or too large to read` : `${rel} isn't in the repo`);
            }
            const lines = text.split("\n");
            const from = Math.max(1, startLine ?? 1);
            const to = Math.min(lines.length, endLine ?? from + 249, from + 299);
            const before = seen.get(rel) ?? [];
            if (before.some(([a, b]) => a <= from && to <= b)) {
              return { path: rel, lines: `${from}-${to} of ${lines.length}`, content: "(You already read these lines above.)" };
            }
            seen.set(rel, [...before, [from, to]]);
            return {
              path: rel,
              lines: `${from}-${to} of ${lines.length}`,
              content: clip(
                lines
                  .slice(from - 1, to)
                  .map((l, i) => `${from + i}: ${l}`)
                  .join("\n"),
                10_000,
              ),
            };
          },
          (r) => `lines ${r.lines}`,
        ),
    });

    tools.listRepoDir = tool({
      description: "List a folder in the project's repo.",
      inputSchema: z.object({ path: z.string().max(300).describe('Folder relative to the repo root; "" for the root') }),
      execute: ({ path }) =>
        call(
          `Listed ${path || "the repo root"}`,
          async () => {
            const rel = repoPath(path);
            const prefix = rel ? `${rel}/` : "";
            const names = new Set(
              snap.files
                .filter((f) => f.startsWith(prefix))
                .map((f) => {
                  const rest = f.slice(prefix.length);
                  return rest.includes("/") ? `${rest.split("/")[0]}/` : rest;
                }),
            );
            if (names.size === 0) throw new Error(`${rel || "The root"} is empty or isn't a folder`);
            return { entries: [...names].sort().slice(0, 200) };
          },
          (r) => r.entries.slice(0, 40).join("  "),
        ),
    });
  }

  const sandbox = collected.sandbox;
  if (sandbox && mechanisms.includes("sandbox_run")) {
    notes.push(
      `runCommand runs shell commands in this project's sandbox branch: ${sandbox.description} Earlier install/build/test commands already ran there (see the Sandbox run evidence). There are no API keys or secrets in it: if the project needs them, say so rather than treating the failure as a bug.`,
    );
    tools.runCommand = tool({
      description: "Run a shell command in the project's Nebius sandbox (the repo is the working directory). Returns the exit code and the end of its output.",
      inputSchema: z.object({
        command: z.string().min(1).max(2000),
        timeoutSec: z.number().int().min(10).max(300).optional().describe("Default 180"),
      }),
      execute: ({ command, timeoutSec }) =>
        call(
          `$ ${command}`,
          async () => {
            const r = await sandbox.run({ command, timeoutSec: timeoutSec ?? 180, abortSignal: signal });
            return { exitCode: r.exitCode, timedOut: r.timedOut, seconds: r.seconds, output: commandOutput(r, 3000) };
          },
          (r) => `exit ${r.exitCode}${r.timedOut ? " (timed out)" : ""} after ${r.seconds}s\n${r.output}`,
        ),
    });
  }

  if (mechanisms.includes("web_scraper") || mechanisms.includes("agent_judge")) {
    tools.readWebPage = tool({
      description: "Read a web page (the project's demo or docs, a library's docs, a competitor) as markdown.",
      inputSchema: z.object({
        url: z.url(),
        focus: z.string().max(300).optional().describe("What you're looking for; long pages come back as the most relevant parts"),
      }),
      execute: ({ url, focus }) =>
        call(
          `Read ${url}`,
          async () => {
            const [page] = await readPages([url], { focus });
            if (!page?.ok) throw new Error(page?.error ?? "Couldn't read it");
            return { url: page.url, title: page.title, content: clip(page.content ?? "", 10_000) };
          },
          (r) => `${r.title ?? ""}\n${clip(r.content, 800)}`,
        ),
    });
    tools.searchWeb = tool({
      description: "Search the web, e.g. for prior art, whether an idea already exists, or whether a claim holds up.",
      inputSchema: z.object({ query: z.string().min(2).max(300) }),
      execute: ({ query }) =>
        call(
          `Searched the web for "${query}"`,
          async () => {
            const res = await searchWeb(query, 5);
            if ("error" in res && res.error) throw new Error(res.error);
            return res;
          },
          (r) => [r.answer, ...r.results.map((x) => `${x.title} ${x.url}`)].filter(Boolean).join("\n"),
        ),
    });
  }

  if (mechanisms.includes("video_reviewer")) {
    tools.lookAtImage = tool({
      description: "Ask the vision model a specific question about one of the demo video's frames or its thumbnail.",
      inputSchema: z.object({ url: z.url(), question: z.string().min(3).max(500) }),
      execute: ({ url, question }) =>
        call(
          `Looked at ${url}: ${question}`,
          async () => {
            const { seen, usage, model } = await viewImages([{ label: question, urls: [url] }], { focus: question, tier, signal });
            rec.addUsage(usage);
            if (seen[0]?.error) throw new Error(seen[0].error);
            return { model, answer: describeImages(seen) };
          },
          (r) => r.answer,
        ),
    });
  }

  const video = collected.video;
  if (video?.transcript && mechanisms.includes("video_reviewer")) {
    notes.push(`The video is ${video.durationSec !== null ? formatTime(video.durationSec) : "of unknown length"}; its transcript is in the evidence with [m:ss] stamps.`);
  }

  return { tools, notes };
}
