import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, Eyebrow, Panel, cn } from "@/components/ui";
import type { Criterion } from "@/lib/data";
import { describeGateFails, type GateStatus } from "@/lib/gate-status";
import { average } from "@/lib/ranking";
import { reviewerName, type ProjectReview } from "@/lib/reviews";
import { JudgePhoto } from "../../../setup/judges/judge-photo";

const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(1));

/** The average of submitted reviews on one criterion: a score, or "2/3" passes. */
function criterionAverage(submitted: ProjectReview[], c: Criterion) {
  const vals = submitted.map((r) => r.scores[c.id]).filter((v) => v !== undefined);
  if (!vals.length) return "–";
  if (c.scale === "pass_fail") return `${vals.filter((v) => v === true).length}/${vals.length} pass`;
  return fmt(average(vals.map(Number)));
}

/**
 * "1 of 2 judges in · +1 admin": progress counts the judges' assignments, and
 * admins' own scores (which count in the average) are added on.
 */
function reviewsIn(reviews: ProjectReview[]) {
  const judges = reviews.filter((r) => !r.admin);
  const done = judges.filter((r) => r.submittedAt).length;
  const admins = reviews.filter((r) => r.admin && r.submittedAt).length;
  return `${judges.length ? `${done} of ${judges.length} ${judges.length === 1 ? "judge" : "judges"} in` : "no judges assigned"}${
    admins ? ` · +${admins} admin` : ""
  }`;
}

/**
 * The project's score at a glance: the judge average from the latest phase it
 * was reviewed in, each criterion's average, and the agent's total.
 */
export function ScoresPanel({
  reviews,
  criteria,
  agent,
  agentFlagged = 0,
}: {
  reviews: ProjectReview[];
  criteria: Criterion[];
  /** gatePassed counts a failure the agent-failed inbox overturned as a pass. */
  agent: { total: number; gatePassed: boolean; gateOverturned?: boolean } | null;
  /** Agent steps waiting on a person. */
  agentFlagged?: number;
}) {
  // Reviews come latest phase first.
  const phase = reviews[0]?.phase;
  const current = reviews.filter((r) => r.phase.id === phase?.id);
  const submitted = current.filter((r) => r.submittedAt);
  const avg = average(submitted.map((r) => r.total ?? 0));

  return (
    <Panel className="flex flex-col gap-4 p-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg leading-none">Scores</h2>
          {phase ? (
            <a href="#judges" className="truncate text-xs text-muted hover:text-foreground">
              {phase.name} · {reviewsIn(current)}
            </a>
          ) : (
            <span className="text-xs text-muted">No judges yet</span>
          )}
        </div>
        <span className={cn("font-pixel text-4xl leading-none", avg === null && "text-muted")}>{fmt(avg)}</span>
      </div>

      <dl className="flex flex-col gap-2.5 border-t border-border pt-4 text-sm">
        {criteria.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <dt className="truncate text-muted">{c.title}</dt>
            <dd className="shrink-0 font-pixel">
              {criterionAverage(submitted, c)} <span className="text-muted">· {c.weight}%</span>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          <dt>
            <a href="#agent" className="flex items-center gap-1.5 text-muted hover:text-foreground">
              <PixelIcon name="spark" size={10} /> Agent
            </a>
          </dt>
          <dd className="shrink-0 font-pixel">
            {agent ? fmt(agent.total) : <span className="text-muted">–</span>}
            {agent && !agent.gatePassed && (
              <Badge tone="danger" className="ml-2">
                gate
              </Badge>
            )}
            {agent?.gateOverturned && (
              <Badge tone="success" className="ml-2" title="The agent failed a gate; the inbox put it back in the pool">
                Gate overturned
              </Badge>
            )}
            {agentFlagged > 0 && (
              <Badge tone="warning" className="ml-2">
                <PixelIcon name="flag" size={10} /> {agentFlagged}
              </Badge>
            )}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

/**
 * Every review of the project, one table per phase with the latest first:
 * each judge's score on each criterion, their totals and notes, and the
 * averages.
 */
export function JudgeScores({
  reviews,
  criteria,
  gate,
  scorePhase,
  base,
}: {
  reviews: ProjectReview[];
  criteria: Criterion[];
  /** Gates the judges failed, under the hackathon's rule. */
  gate: GateStatus | null;
  /** The running phase the project is in, where an admin can add their own score. */
  scorePhase: { id: string; name: string } | null;
  /** The project page's URL; judge views and the admin's score live under it. */
  base: string;
}) {
  const phases = [...new Map(reviews.map((r) => [r.phase.id, r.phase])).values()];
  // One admin score per phase, for now whoever owns the hackathon.
  const addScoreIn = scorePhase && !reviews.some((r) => r.phase.id === scorePhase.id && r.admin) ? scorePhase : null;
  if (addScoreIn && !phases.some((ph) => ph.id === addScoreIn.id)) {
    phases.unshift({ id: addScoreIn.id, name: addScoreIn.name, position: Infinity, running: true });
  }

  return (
    <section id="judges" className="scroll-mt-40">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg leading-none">Judges</h2>
        {phases.length > 1 && <span className="text-sm text-muted">latest phase first</span>}
      </div>

      {gate && (
        <p
          className={cn(
            "mb-4 flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm",
            gate.ruledOut ? "bg-danger-soft text-danger-soft-foreground" : "bg-warning-soft text-warning-soft-foreground",
          )}
        >
          <PixelIcon name="flag" size={12} />
          <span>
            {describeGateFails(gate.fails)} — {gate.ruledOut ? "ruled out" : "flagged for an admin to decide"}
          </span>
        </p>
      )}

      {phases.length === 0 ? (
        <Panel className="p-6 text-sm text-muted">Judges show here once judging starts and this project is assigned.</Panel>
      ) : (
        <Panel className="divide-y-2 divide-border overflow-hidden">
          {phases.map((ph) => (
            <PhaseScores
              key={ph.id}
              phase={ph}
              reviews={reviews.filter((r) => r.phase.id === ph.id)}
              criteria={criteria}
              addScore={addScoreIn?.id === ph.id}
              base={base}
            />
          ))}
        </Panel>
      )}
    </section>
  );
}

function PhaseScores({
  phase,
  reviews,
  criteria,
  addScore,
  base,
}: {
  phase: ProjectReview["phase"];
  reviews: ProjectReview[];
  criteria: Criterion[];
  /** Offer the admin their own score in this phase. */
  addScore: boolean;
  base: string;
}) {
  const submitted = reviews.filter((r) => r.submittedAt);
  const avg = average(submitted.map((r) => r.total ?? 0));
  const notes = submitted.filter((r) => r.notes);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface-secondary/60 px-5 py-3">
        <Eyebrow className="text-foreground">{phase.name}</Eyebrow>
        {phase.running && (
          <Badge tone="accent" dot>
            running
          </Badge>
        )}
        <span className="text-xs text-muted">{reviewsIn(reviews)}</span>
        <span className={cn("ml-auto font-pixel text-xl leading-none", avg === null && "text-muted")} title="Average total">
          {fmt(avg)}
        </span>
      </div>

      {reviews.length > 0 && (
        <div className="overflow-x-auto">
          {/* Criteria down the side and a column per review, so long criterion names stay readable. */}
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-5 pt-4 pb-2 text-left align-bottom text-xs font-normal text-muted">
                  Criterion
                </th>
                {reviews.map((r) => (
                  <th key={r.id} scope="col" className="w-24 px-2 pt-4 pb-2 align-bottom font-normal">
                    <Reviewer review={r} base={base} running={phase.running} />
                  </th>
                ))}
                <th scope="col" className="w-20 px-5 pt-4 pb-2 text-right align-bottom text-xs font-normal text-muted">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal">
                    <span className="block min-w-36">{c.title}</span>
                    <span className="font-pixel text-xs text-muted">
                      {c.weight}%{c.gate && " · gate"}
                    </span>
                  </th>
                  {reviews.map((r) => (
                    <td key={r.id} className="px-2 py-2.5 text-center">
                      <Verdict value={r.submittedAt ? r.scores[c.id] : undefined} />
                    </td>
                  ))}
                  <td className="px-5 py-2.5 text-right font-pixel whitespace-nowrap">{criterionAverage(submitted, c)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <th scope="row" className="px-5 py-3 text-left font-pixel text-xs font-normal tracking-wide text-muted uppercase">
                  Total
                </th>
                {reviews.map((r) => (
                  <td key={r.id} className="px-2 py-3 text-center">
                    {r.submittedAt ? (
                      <span className="font-pixel text-lg">{fmt(r.total)}</span>
                    ) : (
                      <span className="text-xs text-muted">{phase.running ? "pending" : "not scored"}</span>
                    )}
                  </td>
                ))}
                <td className="px-5 py-3 text-right font-pixel text-lg">{fmt(avg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-3 border-t border-border px-5 py-4">
          {notes.map((r) => (
            <li key={r.id} className="flex gap-3 text-sm">
              <JudgePhoto name={reviewerName(r)} imagePath={r.judge?.imagePath ?? null} size={24} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted">
                  <span className="text-foreground">{reviewerName(r)}</span>
                  {r.admin ? " · admin" : r.submittedBy ? " · entered by admin" : ""}
                </span>
                <p className="whitespace-pre-wrap">{r.notes}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addScore && (
        <Link
          href={`${base}/score`}
          className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-muted transition hover:bg-surface-secondary/50 hover:text-foreground"
        >
          <PixelIcon name="plus" size={10} />
          Add your score
          <span className="text-xs">· one more review in {phase.name}&apos;s average</span>
        </Link>
      )}
    </div>
  );
}

/**
 * A review's column heading: who it's by, opening the admin's copy of their
 * judge view (or the admin's own score). While the phase runs, a judge's
 * heading also links to their own page for this project.
 */
function Reviewer({ review: r, base, running }: { review: ProjectReview; base: string; running: boolean }) {
  const name = reviewerName(r);
  return (
    <div className="flex flex-col items-center gap-1">
      <Link
        href={r.admin ? `${base}/score` : `${base}/review/${r.id}`}
        title={r.admin ? "Open your score" : `Open ${name}'s judge view`}
        className="flex flex-col items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-surface-secondary"
      >
        <JudgePhoto name={name} imagePath={r.judge?.imagePath ?? null} size={28} />
        <span className="max-w-20 truncate text-xs">{name}</span>
      </Link>
      {r.admin ? (
        <Badge>admin</Badge>
      ) : (
        // A judge's link only opens projects in the running phase.
        running &&
        r.judge?.accessToken && (
          <a
            href={`/j/${r.judge.accessToken}?p=${r.id}`}
            target="_blank"
            rel="noreferrer"
            title={`Open ${name}'s judging page for this project. Scores entered there count as theirs.`}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] whitespace-nowrap text-muted transition hover:bg-surface-secondary hover:text-foreground"
          >
            Judge page <PixelIcon name="external" size={9} />
          </a>
        )
      )}
    </div>
  );
}

/** One judge's score on one criterion: 1–10, or a pass/fail badge. */
function Verdict({ value }: { value: number | boolean | undefined }) {
  if (value === undefined) return <span className="text-muted">–</span>;
  if (typeof value === "boolean") return <Badge tone={value ? "success" : "danger"}>{value ? "pass" : "fail"}</Badge>;
  return <span className="font-pixel text-base">{value}</span>;
}
