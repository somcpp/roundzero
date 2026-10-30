import { web } from "@/lib/ai";
import { clip } from "./fetch";

// The live web through Tavily: reading a project's pages (with an optional
// focus, so long pages come back as the chunks that matter), crawling a demo
// site with the organizer's instructions, and searching for prior art.

export type PageRead = {
  url: string;
  ok: boolean;
  title?: string | null;
  content?: string;
  images?: string[];
  error?: string;
};

const MAX_PAGE = 12_000;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function readPages(
  urls: string[],
  { focus, deep = false }: { focus?: string; deep?: boolean },
): Promise<PageRead[]> {
  if (urls.length === 0) return [];
  if (!process.env.TAVILY) return urls.map((url) => ({ url, ok: false, error: "TAVILY isn't set" }));
  try {
    const res = await web.extract(urls, {
      format: "markdown",
      extractDepth: deep ? "advanced" : "basic",
      includeImages: true,
      timeout: 40,
      ...(focus ? { query: clip(focus, 400), chunksPerSource: 5 } : {}),
    });
    const read = new Map<string, PageRead>();
    for (const r of res.results) {
      read.set(r.url, { url: r.url, ok: true, title: r.title, content: clip(r.rawContent ?? "", MAX_PAGE), images: r.images ?? [] });
    }
    for (const f of res.failedResults) read.set(f.url, { url: f.url, ok: false, error: f.error });
    return urls.map((url) => read.get(url) ?? [...read.values()].find((r) => sameish(r.url, url)) ?? { url, ok: false, error: "Nothing came back" });
  } catch (e) {
    return urls.map((url) => ({ url, ok: false, error: message(e) }));
  }
}

/** Tavily may hand back a normalized URL (trailing slash, redirect). */
const sameish = (a: string, b: string) => a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

export async function crawlSite(url: string, { instructions, limit = 6 }: { instructions?: string; limit?: number }) {
  if (!process.env.TAVILY) return { ok: false as const, error: "TAVILY isn't set", pages: [] as PageRead[] };
  try {
    const res = await web.crawl(url, {
      instructions: instructions ? clip(instructions, 400) : undefined,
      limit,
      maxDepth: 2,
      maxBreadth: 10,
      extractDepth: "basic",
      format: "markdown",
      includeImages: true,
      timeout: 90,
    });
    return {
      ok: true as const,
      pages: res.results.map((r) => ({ url: r.url, ok: true, content: clip(r.rawContent ?? "", 4000), images: r.images ?? [] })),
    };
  } catch (e) {
    return { ok: false as const, error: message(e), pages: [] as PageRead[] };
  }
}

export async function searchWeb(query: string, maxResults = 5) {
  if (!process.env.TAVILY) return { answer: null, results: [], error: "TAVILY isn't set" };
  try {
    const res = await web.search(query, { maxResults, includeAnswer: "basic", searchDepth: "basic" });
    return {
      answer: res.answer ?? null,
      results: res.results.map((r) => ({ title: r.title, url: r.url, snippet: clip(r.content ?? "", 500) })),
    };
  } catch (e) {
    return { answer: null, results: [], error: message(e) };
  }
}
