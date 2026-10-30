import config from "../../branding.config.js";

/**
 * Preset brand colors. `blue` is HeroUI's default accent; `purple` is the
 * RoundZero default. The rest mirror the hackathon color swatches.
 */
export const BRAND_COLORS = {
  purple: "#6e56e7",
  blue: "#0485f7",
  sky: "#0284c7",
  teal: "#0d9488",
  green: "#16a34a",
  amber: "#ca8a04",
  orange: "#ea580c",
  rose: "#e11d48",
  pink: "#db2777",
  zinc: "#18181b",
} as const;

export type BrandColorName = keyof typeof BRAND_COLORS;

export type BrandingConfig = {
  name: string;
  badge: string;
  logo?: string | null;
  color: BrandColorName | `#${string}`;
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function resolveColor(color: string): string {
  if (color in BRAND_COLORS) return BRAND_COLORS[color as BrandColorName];
  if (HEX.test(color)) return color;
  throw new Error(`branding.config.js: color must be a preset (${Object.keys(BRAND_COLORS).join(", ")}) or a hex like "#ff5a1f", got "${color}"`);
}

/** White or near-black, whichever reads better on the given hex. */
export function foregroundFor(hex: string): string {
  const full = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast vs white is 1.05 / (L + 0.05); vs black is (L + 0.05) / 0.05.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#18181b";
}

const cfg = config as BrandingConfig;
const color = resolveColor(cfg.color);

export const brand = {
  name: cfg.name,
  badge: cfg.badge,
  logo: cfg.logo ?? null,
  color,
  colorForeground: foregroundFor(color),
};
