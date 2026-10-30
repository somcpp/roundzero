import { foregroundFor } from "@/lib/branding";

// Email clients don't do oklch, color-mix or CSS variables, so the app's
// tokens (globals.css) are flattened to hex here and hackathon colors are
// mixed ahead of time.

export const palette = {
  background: "#f7f7f9",
  surface: "#ffffff",
  surfaceSecondary: "#f4f4f6",
  border: "#e4e4e8",
  borderStrong: "#d1d1d8",
  foreground: "#18181b",
  muted: "#71717a",
  warning: "#b45309",
  warningSoft: "#fef3c7",
};

// Geist from the same package the app ships, via jsDelivr. Apple Mail and
// iOS render them; Gmail and Outlook fall back to the stacks below.
const GEIST_FONTS = "https://cdn.jsdelivr.net/npm/geist@1.7.2/dist/fonts";
export const fontFiles = {
  sans: (weight: 400 | 500 | 600) =>
    `${GEIST_FONTS}/geist-sans/Geist-${{ 400: "Regular", 500: "Medium", 600: "SemiBold" }[weight]}.woff2`,
  pixel: `${GEIST_FONTS}/geist-pixel/GeistPixel-Square.woff2`,
};

export const fonts = {
  sans: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  /** Headings and numbers, like `font-pixel` in the app. Falls back to bold sans. */
  pixel: "'Geist Pixel', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  /** Eyebrows and codes. */
  mono: "'Geist Pixel', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function rgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex.trim());
  if (!m) return [110, 86, 231];
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** `amount` of `b` mixed into `a`, like color-mix(in srgb, a, b amount). */
export function mix(a: string, b: string, amount: number) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/** The accent family for a hackathon color, as globals.css derives it. */
export function accentTokens(color: string) {
  // Mixing with nothing normalizes "#abc" (or a bad value) to "#aabbcc".
  const accent = mix(color, color, 0);
  return {
    accent,
    accentForeground: foregroundFor(accent),
    /** The darker bottom edge on filled buttons and tiles. */
    accentLip: mix(accent, "#000000", 0.22),
    accentSoft: mix("#ffffff", accent, 0.1),
    accentSoftForeground: mix(accent, "#000000", 0.2),
    /** The bottom edge of tiles and panels sitting on accentSoft. */
    accentSoftLip: mix("#ffffff", accent, 0.2),
    /** The pixel cover's backdrop. */
    coverBackground: mix("#ffffff", accent, 0.08),
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The hackathon's pixel cover, cell for cell. Mirrors coverCells() in
 * components/ui.tsx so a hackathon's emails wear the same pattern as its pages.
 */
export function coverCells(seed: string) {
  const W = 24;
  const H = 12;
  let h = hash(seed);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const cells: { x: number; y: number; o: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W / 2; x++) {
      const p = 0.08 + (y / H) * 0.55;
      if (rand() < p) {
        const o = 0.25 + rand() * 0.75;
        cells.push({ x, y, o }, { x: W - 1 - x, y, o });
      }
    }
  }
  return { W, H, cells };
}
