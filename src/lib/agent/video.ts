import { clip, fetchUntrusted, fetchUntrustedText, withTimeout } from "./fetch";
import { readPages } from "./web";

// What the agent can learn about a demo video without watching it: metadata,
// the transcript, and a few frames for the vision model. YouTube goes through
// ScrapeCreators; Vimeo through its player config and caption tracks; Loom
// through oEmbed; anything else is read as a web page.

export type VideoFrame = { label: string; urls: string[] };

export type VideoInfo = {
  url: string;
  host: "youtube" | "vimeo" | "loom" | "other";
  title: string | null;
  description: string | null;
  durationSec: number | null;
  publishedAt: string | null;
  chapters: { title: string; startSec: number }[];
  /** "[m:ss] text" lines. */
  transcript: string | null;
  transcriptNote: string | null;
  /** Thumbnail and frames from through the video, each with fallback URLs. */
  frames: VideoFrame[];
  notes: string[];
};

export const formatTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const MAX_TRANSCRIPT = 16_000;

/** Timed lines grouped into ~20s paragraphs, so a 3 minute video is a handful of lines. */
function joinTranscript(lines: { startSec: number; text: string }[]) {
  const out: string[] = [];
  let start = -Infinity;
  let buf: string[] = [];
  const flush = () => buf.length && out.push(`[${formatTime(start)}] ${buf.join(" ").replace(/\s+/g, " ").trim()}`);
  for (const l of lines) {
    if (l.startSec - start >= 20) {
      flush();
      start = l.startSec;
      buf = [];
    }
    buf.push(l.text);
  }
  flush();
  const text = out.join("\n");
  return text.length > MAX_TRANSCRIPT ? `${text.slice(0, MAX_TRANSCRIPT)}\n[…transcript cut here]` : text;
}

// ── YouTube ───────────────────────────────────────────────────────────────

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = u.pathname === "/watch" ? u.searchParams.get("v") : (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ?? null);
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function scrapeCreators<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const key = process.env.SCRAPE_CREATORS_API_KEY;
  if (!key) throw new Error("SCRAPE_CREATORS_API_KEY isn't set");
  const res = await fetch(`https://api.scrapecreators.com${path}?${new URLSearchParams(params)}`, {
    headers: { "x-api-key": key },
    signal: withTimeout(45_000, signal),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as (T & { success?: boolean; message?: string; error?: string }) | null;
  if (!res.ok || !body || body.success === false) {
    throw new Error(body?.message || body?.error || `ScrapeCreators ${res.status}`);
  }
  return body;
}

type YouTubeVideo = {
  title?: string;
  description?: string;
  durationMs?: number;
  publishDate?: string;
  chapters?: { title: string; startSeconds: number }[];
};
type YouTubeTranscript = {
  transcript?: { text: string; startMs: string | number }[] | null;
  language?: string;
};

async function youtube(url: string, id: string, signal?: AbortSignal): Promise<VideoInfo> {
  const info: VideoInfo = blank(url, "youtube");
  const canonical = `https://www.youtube.com/watch?v=${id}`;
  const [video, transcript] = await Promise.allSettled([
    scrapeCreators<YouTubeVideo>("/v1/youtube/video", { url: canonical }, signal),
    scrapeCreators<YouTubeTranscript>("/v1/youtube/video/transcript", { url: canonical }, signal),
  ]);
  if (video.status === "fulfilled") {
    const v = video.value;
    info.title = v.title ?? null;
    info.description = v.description ? clip(v.description, 2000) : null;
    info.durationSec = v.durationMs ? v.durationMs / 1000 : null;
    info.publishedAt = v.publishDate ?? null;
    info.chapters = (v.chapters ?? []).map((c) => ({ title: c.title, startSec: c.startSeconds }));
  } else {
    info.notes.push(`Couldn't load the video's details: ${reason(video.reason)}`);
  }
  if (transcript.status === "fulfilled" && transcript.value.transcript?.length) {
    info.transcript = joinTranscript(
      transcript.value.transcript.map((t) => ({ startSec: Number(t.startMs) / 1000, text: t.text })),
    );
    info.transcriptNote = `Captions${transcript.value.language ? ` (${transcript.value.language})` : ""} from YouTube`;
  } else {
    info.transcriptNote = transcript.status === "rejected" ? `No transcript: ${reason(transcript.reason)}` : "The video has no captions";
  }
  if (video.status === "rejected" && transcript.status === "rejected") {
    info.notes.push("The video may be private, deleted, or not a real YouTube link.");
    return info;
  }
  // YouTube keeps auto-generated frames from 25%, 50% and 75% through every video.
  const img = (name: string) => `https://i.ytimg.com/vi/${id}/${name}.jpg`;
  info.frames = [
    { label: "thumbnail", urls: [img("maxresdefault"), img("hqdefault")] },
    { label: "frame ¼ of the way in", urls: [img("maxres1"), img("hq1")] },
    { label: "frame halfway in", urls: [img("maxres2"), img("hq2")] },
    { label: "frame ¾ of the way in", urls: [img("maxres3"), img("hq3")] },
  ];
  return info;
}

// ── Vimeo ─────────────────────────────────────────────────────────────────

export function vimeoId(url: string): { id: string; hash: string | null } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => /^\d{5,12}$/.test(p));
    if (i === -1) return null;
    const hash = u.searchParams.get("h") ?? (parts[i + 1] && /^[0-9a-f]{6,20}$/i.test(parts[i + 1]) ? parts[i + 1] : null);
    return { id: parts[i], hash };
  } catch {
    return null;
  }
}

type VimeoConfig = {
  video?: { title?: string; duration?: number; thumbs?: Record<string, string>; thumbnail_url?: string };
  request?: { text_tracks?: { lang: string; url: string; label?: string }[] };
};

/** WebVTT cues as timed lines. */
function parseVtt(vtt: string) {
  const lines: { startSec: number; text: string }[] = [];
  for (const block of vtt.replace(/\r/g, "").split("\n\n")) {
    const rows = block.split("\n");
    const at = rows.findIndex((r) => r.includes("-->"));
    if (at === -1) continue;
    const m = rows[at].match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
    if (!m) continue;
    const startSec = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    const text = rows.slice(at + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) lines.push({ startSec, text });
  }
  return lines;
}

async function vimeo(url: string, ref: { id: string; hash: string | null }, signal?: AbortSignal): Promise<VideoInfo> {
  const info = blank(url, "vimeo");
  const config = await fetchUntrustedText(
    `https://player.vimeo.com/video/${ref.id}/config${ref.hash ? `?h=${ref.hash}` : ""}`,
    { accept: "application/json", signal },
  );
  if (!config.ok) {
    info.notes.push(`Couldn't load the Vimeo player (${config.error}); it may be private or embedding may be off.`);
    return info;
  }
  let cfg: VimeoConfig;
  try {
    cfg = JSON.parse(config.text) as VimeoConfig;
  } catch {
    info.notes.push("Vimeo returned something unexpected.");
    return info;
  }
  info.title = cfg.video?.title ?? null;
  info.durationSec = cfg.video?.duration ?? null;
  const thumb = cfg.video?.thumbs?.["1280"] ?? cfg.video?.thumbs?.base ?? cfg.video?.thumbnail_url;
  if (thumb) info.frames = [{ label: "thumbnail", urls: [thumb] }];

  const tracks = cfg.request?.text_tracks ?? [];
  const track = tracks.find((t) => t.lang?.toLowerCase().startsWith("en")) ?? tracks[0];
  if (!track) {
    info.transcriptNote = "The video has no captions";
  } else {
    const vtt = await fetchUntrustedText(new URL(track.url, "https://player.vimeo.com").toString(), { signal });
    if (vtt.ok) {
      info.transcript = joinTranscript(parseVtt(vtt.text));
      info.transcriptNote = `Captions (${track.label ?? track.lang}) from Vimeo`;
    } else {
      info.transcriptNote = `Couldn't load the captions: ${vtt.error}`;
    }
  }
  return info;
}

// ── Loom and the rest ─────────────────────────────────────────────────────

async function loom(url: string, signal?: AbortSignal): Promise<VideoInfo> {
  const info = blank(url, "loom");
  const r = await fetchUntrusted(`https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`, { accept: "application/json", signal });
  if (!r.ok) {
    info.notes.push(`Couldn't load the Loom video (${r.error}); it may be private.`);
    return info;
  }
  try {
    const o = JSON.parse(new TextDecoder().decode(r.bytes)) as { title?: string; duration?: number; thumbnail_url?: string; description?: string };
    info.title = o.title ?? null;
    info.description = o.description ?? null;
    info.durationSec = o.duration ?? null;
    if (o.thumbnail_url) info.frames = [{ label: "thumbnail", urls: [o.thumbnail_url] }];
  } catch {}
  info.transcriptNote = "Loom doesn't share transcripts publicly";
  return info;
}

async function other(url: string): Promise<VideoInfo> {
  const info = blank(url, "other");
  const [page] = await readPages([url], {});
  if (page?.ok) {
    info.title = page.title ?? null;
    info.description = page.content ? clip(page.content, 3000) : null;
    info.frames = (page.images ?? []).slice(0, 2).map((src, i) => ({ label: `image ${i + 1} on the page`, urls: [src] }));
  } else {
    info.notes.push(`Couldn't load the page: ${page?.error ?? "unknown error"}`);
  }
  info.transcriptNote = "Not a YouTube, Vimeo or Loom link, so there's no transcript";
  return info;
}

const blank = (url: string, host: VideoInfo["host"]): VideoInfo => ({
  url,
  host,
  title: null,
  description: null,
  durationSec: null,
  publishedAt: null,
  chapters: [],
  transcript: null,
  transcriptNote: null,
  frames: [],
  notes: [],
});

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function inspectVideo(url: string, signal?: AbortSignal): Promise<VideoInfo> {
  const yt = youtubeId(url);
  if (yt) return youtube(url, yt, signal);
  const vm = vimeoId(url);
  if (vm) return vimeo(url, vm, signal);
  if (/^https?:\/\/(www\.)?loom\.com\/(share|embed)\//i.test(url)) return loom(url, signal);
  return other(url);
}

/** A duration limit like "≤ 3 min" or "under 2 minutes" in a block's expected answer, in seconds. */
export function durationLimit(expected: string): number | null {
  const m = expected.match(/(\d+(?:\.\d+)?)\s*(?:min|minute)/i);
  return m ? Math.round(Number(m[1]) * 60) : null;
}

/** A readable summary for the judge. */
export function describeVideo(v: VideoInfo, expected: string) {
  const limit = durationLimit(expected);
  const lines = [`Video: ${v.url} (${v.host})`];
  if (v.title) lines.push(`Title: ${v.title}`);
  if (v.durationSec !== null) {
    const over = limit !== null && v.durationSec > limit;
    lines.push(
      `Length: ${formatTime(v.durationSec)}${limit !== null ? ` — the form asks for ${expected}; ${over ? `it's ${formatTime(v.durationSec - limit)} over` : "within the limit"}` : ""}`,
    );
  }
  if (v.publishedAt) lines.push(`Published: ${v.publishedAt}`);
  if (v.chapters.length) lines.push(`Chapters: ${v.chapters.map((c) => `${formatTime(c.startSec)} ${c.title}`).join(" · ")}`);
  if (v.description) lines.push(`Description: ${clip(v.description, 1500)}`);
  lines.push(`Transcript: ${v.transcriptNote ?? "none"}`);
  if (v.transcript) lines.push(v.transcript);
  for (const n of v.notes) lines.push(`Note: ${n}`);
  return lines.join("\n");
}
