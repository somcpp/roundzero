import { PixelIcon } from "@/components/pixel-icon";
import { Badge, cn } from "@/components/ui";
import type { JudgingPhase, ProjectRecord } from "@/lib/data";
import { SUBMITTED_COLOR, phaseColor } from "@/lib/phase-colors";
import { FunnelPixels } from "./funnel-pixels";

type Stage = {
  key: string;
  name: string;
  /** Hex; each stage's shape, square and bar are drawn in it via currentColor. */
  color: string;
  count: number;
  state: "source" | "done" | "active" | "queued";
  note: string;
  /** Who leaves between this stage and the next, for the hover card. */
  lost: string | null;
};

/**
 * The phases as a funnel: how many projects reached each one, flowing into
 * the next. Phases that haven't started show their planned cap, faded.
 */
export function PhaseFunnel({
  phases,
  projects,
  currentIdx,
  progress,
}: {
  phases: JudgingPhase[];
  projects: ProjectRecord[];
  currentIdx: number;
  /** Share of the running phase's reviews that are in. */
  progress: number;
}) {
  const idxOf = new Map(phases.map((p, i) => [p.id, i]));
  // Projects keep the phase they were eliminated in, so "got at least this far" is phase index >= i.
  const reached = (i: number) => projects.filter((p) => p.phaseId && (idxOf.get(p.phaseId) ?? -1) >= i).length;

  const stages: Stage[] = [
    { key: "all", name: "Submitted", color: SUBMITTED_COLOR, count: projects.length, state: "source", note: "all projects", lost: null },
  ];
  phases.forEach((p, i) => {
    const prev = stages[i];
    const state = p.closedAt ? "done" : i === currentIdx ? "active" : "queued";
    const cap = phases[i - 1]?.advanceCount;
    const count = p.startedAt ? reached(i) : cap == null ? prev.count : Math.min(cap, prev.count);
    const next = phases[i + 1];
    const note =
      state === "active"
        ? `${Math.round(progress * 100)}% reviewed`
        : state === "done"
          ? next
            ? `${next.startedAt ? reached(i + 1) : 0} advanced`
            : "winners picked"
          : next
            ? `top ${count} planned`
            : "picks the winners";
    const out = prev.count - count;
    if (out > 0) {
      prev.lost =
        prev.state === "source"
          ? `${out} not in judging`
          : prev.state === "done"
            ? `${out} didn't advance`
            : `${out} won't advance`;
    }
    stages.push({ key: p.id, name: p.name, color: phaseColor(p, i, phases.length), count, state, note, lost: null });
  });

  const n = stages.length;
  const total = stages[0].count;
  const pct = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const chart = "h-[180px] sm:h-[240px]";

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        className="relative overflow-hidden rounded-xl border-2 border-border bg-surface shadow-block"
        style={{ minWidth: `${n * 9}rem` }}
      >
        <ol className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {stages.map((s, i) => {
            const color = { color: s.color };
            return (
              <li key={s.key} className={cn("group relative flex flex-col", i > 0 && "border-l border-border")}>
                <span aria-hidden className="absolute inset-0 bg-current opacity-0 transition-opacity group-hover:opacity-[0.04]" style={color} />
                <div className="relative flex min-w-0 flex-col gap-1.5 px-5 pt-5 pb-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
                    <span className={cn("size-2 shrink-0 rounded-sm bg-current", s.state === "queued" && "opacity-40")} style={color} />
                    <span className="truncate">{s.name}</span>
                    {s.state === "done" && <PixelIcon name="check" size={10} className="shrink-0 text-success" />}
                    {i === n - 1 && i > 0 && <PixelIcon name="trophy" size={10} className="shrink-0" />}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className={cn("font-pixel text-3xl leading-none", s.state === "queued" && "text-muted")}>{s.count}</span>
                    {i > 0 && <span className="text-xs text-muted">{pct(s.count)}%</span>}
                    {s.state === "active" && (
                      <Badge tone="accent" dot className="ml-auto self-center">
                        live
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted">{s.note}</span>
                  {s.state === "active" && (
                    <span className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-secondary">
                      <span className="block h-full rounded-full bg-current" style={{ ...color, width: `${progress * 100}%` }} />
                    </span>
                  )}
                </div>
                <div className={chart} />

                {/* Dub's hover card, over the middle of the stage's column. */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center px-2 pb-4 opacity-0 transition-opacity group-hover:opacity-100",
                    chart,
                  )}
                >
                  <div className="rounded-lg border border-border bg-surface text-sm shadow-sm">
                    <p className="border-b border-border px-4 py-2.5">{s.name}</p>
                    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-sm bg-current opacity-50 shadow-[inset_0_0_0_1px_#0003]" style={color} />
                        <span className="whitespace-nowrap text-muted">{pct(s.count)}%</span>
                      </span>
                      <span className="font-medium whitespace-nowrap">{s.count.toLocaleString()}</span>
                    </div>
                    {s.lost && <p className="border-t border-border px-4 py-2 text-xs whitespace-nowrap text-muted">{s.lost}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Pixel-art shapes: each stage's count easing into the next one's, cell by cell. */}
        <FunnelPixels
          bands={stages.map((s) => ({
            key: s.key,
            color: s.color,
            count: s.count,
            // Planned stages are only a projection, so they're drawn faded.
            faded: s.state === "queued",
            live: s.state === "active",
          }))}
          className={cn("pointer-events-none absolute inset-x-0 bottom-0 w-full", chart)}
        />
      </div>
    </div>
  );
}
