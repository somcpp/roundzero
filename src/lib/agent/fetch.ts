import { fetchUntrustedUrl, readResponseWithSizeLimit } from "@ai-sdk/provider-utils";

// Fetching what entrants link to. Every URL here comes from a submission, so
// it goes through fetchUntrustedUrl: private, loopback and cloud-metadata
// addresses are refused on every redirect hop (with DNS pinned on Node), so a
// submission can't point the server at itself or its network.

export const USER_AGENT = "Mozilla/5.0 (compatible; RoundZeroJudge/1.0)";

export type Fetched =
  | { ok: true; status: number; contentType: string; bytes: Uint8Array }
  | { ok: false; status?: number; error: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A signal that fires on `timeoutMs` or when `signal` does. */
export const withTimeout = (timeoutMs: number, signal?: AbortSignal) =>
  signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs);

export async function fetchUntrusted(
  url: string,
  {
    timeoutMs = 12_000,
    maxBytes = 2_000_000,
    accept = "*/*",
    signal,
  }: { timeoutMs?: number; maxBytes?: number; accept?: string; signal?: AbortSignal } = {},
): Promise<Fetched> {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "Not an http(s) link" };
  try {
    const res = await fetchUntrustedUrl({
      url,
      headers: { "user-agent": USER_AGENT, accept },
      abortSignal: withTimeout(timeoutMs, signal),
      maxRedirects: 5,
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const bytes = await readResponseWithSizeLimit({ response: res, url, maxBytes });
    return { ok: true, status: res.status, contentType, bytes };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function fetchUntrustedText(
  url: string,
  opts?: Parameters<typeof fetchUntrusted>[1],
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const r = await fetchUntrusted(url, opts);
  return r.ok ? { ok: true, text: new TextDecoder().decode(r.bytes) } : r;
}

/** Does the link load? Reads only the status, not the body. */
export async function checkLink(url: string, signal?: AbortSignal) {
  const started = Date.now();
  if (!/^https?:\/\//i.test(url)) return { url, ok: false, error: "Not an http(s) link", ms: 0 };
  try {
    const res = await fetchUntrustedUrl({
      url,
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
      abortSignal: withTimeout(10_000, signal),
      maxRedirects: 5,
    });
    await res.body?.cancel().catch(() => {});
    return { url, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { url, ok: false, error: message(e), ms: Date.now() - started };
  }
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** The image type from the file's first bytes; servers often send the wrong content-type. */
function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

/** An image a vision model can read: PNG, JPEG, WebP or GIF, up to 6 MB. */
export async function fetchImage(
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: true; data: Uint8Array; mediaType: string } | { ok: false; error: string }> {
  const r = await fetchUntrusted(url, { accept: "image/*", maxBytes: 6_000_000, timeoutMs: 15_000, signal });
  if (!r.ok) return r;
  const mediaType = sniffImage(r.bytes) ?? r.contentType.split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(mediaType)) {
    return { ok: false, error: `Not an image the model can read (${mediaType || "unknown type"})` };
  }
  return { ok: true, data: r.bytes, mediaType };
}

/** Cut text to `n` characters, marking the cut. */
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The last `n` characters, for command output where the end matters most. */
export const tail = (s: string, n: number) => (s.length > n ? `…${s.slice(-(n - 1))}` : s);
