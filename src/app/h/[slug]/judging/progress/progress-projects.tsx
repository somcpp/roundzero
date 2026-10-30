"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Segmented } from "@/components/controls";
import { IntentLink } from "@/components/intent-link";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, cn } from "@/components/ui";
import type { ProjectStatus } from "@/lib/data";
import { describeGateFails, type GateStatus } from "@/lib/gate-status";
import type { AgentReview } from "@/lib/judging";
import { formatNumber } from "@/lib/project-fields";
import { StatusBadge } from "../projects/status-badge";

export type ProgressRow = {
  id: string;
  number: number;
  name: string;
  pitch: string;
  phaseName: string | null;
  inCurrentPhase: boolean;
  status: ProjectStatus;
  agent: AgentReview | null;
  /** Gates judges' reviews failed, and whether that rules it out. */
  gate: GateStatus | null;
  submitted: number;
  assigned: number;
  avg: number | null;
};

type View = "phase" | "all";

/**
 * Projects ranked the way closing the phase will rank them, with a line
 * where the advance cutoff falls. "All" lists every project by number.
 */
export function ProgressProjects({
  rows,
  cutoff,
  phaseName,
  slug,
}: {
  rows: ProgressRow[];
  cutoff: number | null;
  phaseName: string | null;
  slug: string;
}) {
  const [view, setView] = useState<View>(phaseName ? "phase" : "all");
  const shown =
    view === "phase"
      ? rows.filter((r) => r.inCurrentPhase && r.status === "active")
      : [...rows].sort((a, b) => a.number - b.number);
  // Reviews and Avg count the running phase, so once judging ends they'd be blank.
  const live = phaseName !== null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl leading-none">Projects</h2>
        <span className="text-sm text-muted">
          {view === "phase" ? "gate passes first, then by average judge score, then agent score" : "every project, by number"}
        </span>
        {phaseName && (
          <Segmented
            size="sm"
            className="ml-auto"
            value={view}
            onChange={setView}
            options={[
              { value: "phase", label: phaseName },
              { value: "all", label: "All projects" },
            ]}
          />
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-muted">
          No projects in this phase.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left">
                {view === "phase" && <Th className="w-12">Rank</Th>}
                <Th className="w-16">#</Th>
                <Th>Project</Th>
                {view === "all" && <Th>Phase</Th>}
                <Th>AI review</Th>
                {live && (
                  <>
                    <Th className="text-right">Reviews</Th>
                    <Th className="text-right">Avg</Th>
                  </>
                )}
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                  <Fragment key={r.id}>
                    {view === "phase" && cutoff !== null && i === cutoff && (
                      <tr>
                        <td colSpan={7} className="border-t-2 border-dashed border-accent px-4 py-1.5">
                          <span className="font-pixel text-xs text-accent">
                            <PixelIcon name="arrow-up" size={10} /> top {cutoff} advance
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className={cn("border-t border-border transition hover:bg-surface-secondary/60", i === 0 && "border-t-0")}>
                      {view === "phase" && (
                        <td className={cn("px-4 py-3 font-pixel", cutoff !== null && i < cutoff ? "text-accent" : "text-muted")}>
                          {i + 1}
                        </td>
                      )}
                      <td className="px-4 py-3 font-pixel text-muted">{formatNumber(r.number)}</td>
                      <td className="max-w-xs px-4 py-3">
                        <IntentLink href={`/h/${slug}/judging/projects/${r.number}`} className="flex min-w-0 flex-col">
                          <span className={cn("truncate font-medium hover:underline", r.status !== "active" && "text-muted")}>
                            {r.name}
                          </span>
                          {r.pitch && <span className="truncate text-xs text-muted">{r.pitch}</span>}
                        </IntentLink>
                      </td>
                      {view === "all" && (
                        <td className="px-4 py-3 whitespace-nowrap">{r.phaseName ?? <span className="text-muted">—</span>}</td>
                      )}
                      <td className="px-4 py-3">
                        <AgentCell review={r.agent} />
                      </td>
                      {live && (
                        <>
                          <td className="px-4 py-3 text-right font-pixel text-xs whitespace-nowrap">
                            {r.assigned ? (
                              <span className={r.submitted === r.assigned ? "text-success-soft-foreground" : undefined}>
                                {r.submitted}/{r.assigned}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-pixel">{r.avg !== null ? r.avg.toFixed(1) : <span className="text-muted">–</span>}</td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <StatusBadge status={r.status} />
                          {r.gate && r.status === "active" && <GateBadge gate={r.gate} />}
                        </span>
                      </td>
                    </tr>
                  </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AgentCell({ review }: { review: AgentReview | null }) {
  if (!review) return <span className="text-muted">—</span>;
  if (review.status === "done") {
    const flagged =
      review.flagged > 0 ? (
        <Badge tone="warning" className="ml-1.5">
          <PixelIcon name="flag" size={10} /> {review.flagged}
        </Badge>
      ) : null;
    return review.gatePassed === false ? (
      <span className="flex items-center">
        <Badge tone="danger">
          <PixelIcon name="lock" size={10} /> gate failed
        </Badge>
        {flagged}
      </span>
    ) : (
      <span className="flex items-center gap-1.5 font-pixel">
        <PixelIcon name="spark" size={10} className="text-accent" />
        {review.total?.toFixed(1) ?? "–"}
        {review.gateOverturned && (
          <Badge tone="success" className="ml-1.5 font-sans" title="The agent failed a gate; the inbox put it back in the pool">
            <PixelIcon name="refresh" size={10} /> Gate overturned
          </Badge>
        )}
        {flagged}
      </span>
    );
  }
  if (review.status === "failed") return <Badge tone="danger">error</Badge>;
  return (
    <Badge tone={review.status === "running" ? "accent" : "neutral"} dot={review.status === "running"}>
      {review.status}
    </Badge>
  );
}

/** Judges failed a gate: ruled out under the hackathon's rule, or flagged for an admin. */
function GateBadge({ gate }: { gate: GateStatus }) {
  return (
    <Badge tone={gate.ruledOut ? "danger" : "warning"} title={describeGateFails(gate.fails)}>
      <PixelIcon name={gate.ruledOut ? "lock" : "flag"} size={10} /> {gate.ruledOut ? "ruled out" : "gate flagged"}
    </Badge>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-2.5 font-pixel text-xs font-normal tracking-wide whitespace-nowrap text-muted uppercase", className)}>
      {children}
    </th>
  );
}
