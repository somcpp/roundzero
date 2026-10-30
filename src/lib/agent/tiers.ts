import type { DoubleCheck, ModelTier } from "@/lib/data";

// The agent's knobs as the UI shows them. Model ids live server-side in
// lib/ai.ts (env can swap them); pages pass the live ones down for display.

export const MODEL_TIERS: { id: ModelTier; label: string; hint: string }[] = [
  { id: "quick", label: "Quick", hint: "Small, fast model. One pass over what the mechanisms found." },
  { id: "balanced", label: "Balanced", hint: "Checks a few things itself with tools before it scores." },
  { id: "deep", label: "In-depth", hint: "Largest model, with room to dig: more tool calls, slower." },
];

export const DOUBLE_CHECKS: { id: DoubleCheck; label: string; hint: string }[] = [
  { id: "off", label: "Off", hint: "Take the first verdict." },
  {
    id: "auto",
    label: "When unsure",
    hint: "Re-checks verdicts with low confidence, flags or a failed gate, one tier up. In-depth re-checks on In-depth.",
  },
  { id: "always", label: "Always", hint: "Re-checks every verdict, one tier up. In-depth re-checks on In-depth." },
];

export const tierLabel = (tier: ModelTier) => MODEL_TIERS.find((t) => t.id === tier)?.label ?? tier;

/** Model id → a short display name, e.g. "nvidia/nemotron-3-super-120b-a12b" → "nemotron-3-super-120b-a12b". */
export const modelName = (id: string) => id.split("/").pop() ?? id;
