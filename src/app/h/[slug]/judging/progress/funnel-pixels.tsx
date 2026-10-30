"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

export type FunnelBand = {
  key: string;
  color: string;
  count: number;
  /** Planned, not reached yet: drawn faded. */
  faded: boolean;
  /** The phase running now: a few of its pixels twinkle. */
  live: boolean;
};

/** Screen pixels per cell. The chart is measured so cells stay square however wide it stretches. */
const CELL = 12;
/** The chart was designed 240 units tall; the padding around the tallest shape scales from that. */
const DESIGN_H = 240;
const PAD = 36;
/**
 * Core, then two one-cell halo rings further out. Each picks from a few fixed
 * shades, like a limited retro palette: mostly solid, with some lighter cells.
 */
const RINGS = [
  { cells: 0, shades: [[1, 0.6], [0.84, 0.28], [0.68, 0.12]] },
  { cells: 1, shades: [[0.3, 0.6], [0.2, 0.4]] },
  { cells: 2, shades: [[0.12, 0.6], [0.07, 0.4]] },
] as const;

/** A shade from [opacity, weight] pairs, by where `r` (0–1) falls in the running weights. */
function shade(shades: readonly (readonly [number, number])[], r: number) {
  let acc = 0;
  for (const [opacity, weight] of shades) {
    acc += weight;
    if (r < acc) return opacity;
  }
  return shades[shades.length - 1][0];
}

/** Same cell, same opacity on every render, so live refreshes don't reshuffle the pixels. */
function noise(a: number, b: number, c: number) {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263) ^ Math.imul(c + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Cell = { x: number; y: number; opacity: number; twinkle: number | null };

/**
 * The funnel's shapes as pixel art: each stage's band starts at its own count
 * and eases into the next one's, filled with square cells of random opacity,
 * under two fainter rings, so the edges step like a sprite.
 */
export function FunnelPixels({ bands, className }: { bands: FunnelBand[]; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cells: Cell[][] = bands.map(() => []);
  if (size && size.w > 0 && size.h > 0) {
    const { w, h } = size;
    const n = bands.length;
    const col = w / n;
    const mid = Math.round(h / 2 / CELL) * CELL;
    const scale = h / DESIGN_H;
    const max = Math.max(1, ...bands.map((b) => b.count));
    const thickness = (count: number) => Math.max(2 * CELL, ((h - 2 * PAD * scale) * count) / max);
    const rows = Math.ceil(h / 2 / CELL) + 1;

    for (let xi = 0; xi * CELL < w; xi++) {
      const cx = xi * CELL + CELL / 2;
      const i = Math.min(n - 1, Math.floor(cx / col));
      // Flat, then eased into the next stage's count across the middle of the column.
      const t = Math.min(1, Math.max(0, ((cx - i * col) / col - 0.3) / 0.4));
      const eased = t * t * (3 - 2 * t);
      const from = thickness(bands[i].count);
      const to = thickness((bands[i + 1] ?? bands[i]).count);
      const half = (from + (to - from) * eased) / 2;

      for (let r = 0; r < rows; r++) {
        const d = r * CELL + CELL / 2;
        const ring = RINGS.findIndex((g) => d <= half + g.cells * CELL);
        if (ring === -1) break;
        for (const side of [-1, 1]) {
          const yi = side < 0 ? 2 * r : 2 * r + 1;
          const fade = bands[i].faded ? 0.35 : 1;
          const opacity = shade(RINGS[ring].shades, noise(i, xi, yi)) * fade;
          const twinkle = bands[i].live && ring === 0 && noise(xi, yi, 97) < 0.07 ? noise(yi, xi, 31) * 2.4 : null;
          cells[i].push({ x: xi * CELL, y: side < 0 ? mid - (r + 1) * CELL : mid + r * CELL, opacity, twinkle });
        }
      }
    }
  }

  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn("pixelated transition-opacity duration-300", size ? "opacity-100" : "opacity-0", className)}
    >
      {bands.map((b, i) => (
        <g key={b.key} fill={b.color}>
          {cells[i].map((c) => (
            <rect
              key={`${c.x}:${c.y}`}
              x={c.x}
              y={c.y}
              width={CELL}
              height={CELL}
              opacity={Math.round(c.opacity * 100) / 100}
              className={c.twinkle === null ? undefined : "animate-pulse motion-reduce:animate-none"}
              style={c.twinkle === null ? undefined : { animationDelay: `${c.twinkle.toFixed(2)}s` }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
