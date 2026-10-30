"use client";

import { BlockRating, Segmented } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, cn } from "@/components/ui";
import type { Criterion } from "@/lib/data";

/** What scoring a criterion needs to know about it. */
export type RubricCriterion = Pick<Criterion, "id" | "title" | "description" | "scale" | "weight" | "gate">;

/** Criterion id → 1–10, or true/false for pass/fail criteria. */
export type RubricScores = Record<string, number | boolean>;

/** Same math as public.save_review_scores: weight-averaged, pass = 10, fail = 0. */
export function weightedTotal(criteria: RubricCriterion[], scores: RubricScores) {
  const scored = criteria.filter((c) => scores[c.id] !== undefined);
  if (!scored.length) return null;
  const value = (c: RubricCriterion) => {
    const v = scores[c.id];
    return typeof v === "boolean" ? (v ? 10 : 0) : v;
  };
  const weight = scored.reduce((n, c) => n + c.weight, 0);
  return weight
    ? scored.reduce((n, c) => n + value(c) * c.weight, 0) / weight
    : scored.reduce((n, c) => n + value(c), 0) / scored.length;
}

/** True when two sets of scores say the same thing. */
export const sameScores = (a: RubricScores, b: RubricScores) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

const verdict = (v: number | boolean) => (typeof v === "boolean" ? (v ? "pass" : "fail") : String(v));

/**
 * One criterion of the rubric: its name, weight and what great looks like, and
 * a control to score it. Once the agent's verdict is revealed it shows next to
 * the score, and a gap of 2 or more (or a different pass/fail) is pointed out.
 * Disable it with a surrounding <fieldset disabled>.
 */
export function RubricField({
  criterion: c,
  value,
  onChange,
  agent,
}: {
  criterion: RubricCriterion;
  value: number | boolean | undefined;
  onChange: (v: number | boolean) => void;
  /** The agent's verdict, once it's been revealed. */
  agent?: number | boolean;
}) {
  const gap = typeof value === "number" && typeof agent === "number" ? Math.abs(value - agent) : 0;
  const disagrees = typeof agent === "boolean" ? value !== undefined && value !== agent : gap >= 2;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium">{c.title}</span>
          <span className="shrink-0 font-pixel text-xs text-muted">{c.weight}%</span>
          {c.gate && <Badge tone="warning">gate</Badge>}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          {agent !== undefined && (
            <span className={cn("font-pixel text-xs", disagrees ? "text-warning-soft-foreground" : "text-muted")}>
              agent {verdict(agent)}
            </span>
          )}
          {c.scale === "score" && (
            <span className="w-6 text-right font-pixel text-xl leading-none">{typeof value === "number" ? value : "–"}</span>
          )}
        </span>
      </div>
      {c.description && <p className="text-xs text-muted">{c.description}</p>}
      {c.scale === "score" ? (
        <BlockRating
          label={c.title}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          ghost={typeof agent === "number" ? agent : null}
        />
      ) : (
        <Segmented
          size="sm"
          value={value === true ? "pass" : value === false ? "fail" : ("" as "pass")}
          onChange={(x) => onChange(x === "pass")}
          options={[
            { value: "pass", label: "Pass" },
            { value: "fail", label: "Fail" },
          ]}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
        />
      )}
      {disagrees && (
        <span className="flex items-center gap-1.5 text-xs text-warning-soft-foreground">
          <PixelIcon name="flag" size={10} />
          {typeof agent === "boolean" ? "The agent disagrees" : `${gap} points from the agent`}. Say why in your notes?
        </span>
      )}
    </div>
  );
}
