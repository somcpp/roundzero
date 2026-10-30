import type { JudgingPhase } from "@/lib/data";

// Phase colors for the progress funnel and the phase editor. A phase uses its
// picked color, or a default by position: violets and pinks, ending in green,
// like Dub's clicks → leads → sales.

/** The funnel's "Submitted" stage, before any phase. */
export const SUBMITTED_COLOR = "#2563eb";

const BETWEEN = ["#7c3aed", "#a855f7", "#d946ef", "#ec4899"];
const LAST = "#10b981";

/** Quick picks in the phase color picker. */
export const PHASE_SWATCHES = ["#2563eb", "#0284c7", ...BETWEEN, "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", LAST];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The color phase `index` of `count` gets when none is picked. */
export function defaultPhaseColor(index: number, count: number) {
  return index === count - 1 ? LAST : BETWEEN[index % BETWEEN.length];
}

export function phaseColor(phase: Pick<JudgingPhase, "color">, index: number, count: number) {
  return phase.color ?? defaultPhaseColor(index, count);
}
