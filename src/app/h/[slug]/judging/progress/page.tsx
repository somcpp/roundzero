import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { JudgeLinkButtons } from "@/components/judge-link";
import { LiveRefresh } from "@/components/live-refresh";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, Eyebrow, ExplainerItem, PageHeader, Panel, SectionTitle, Segments, Stat, cn } from "@/components/ui";
import { listFlaggedSteps, type FlaggedStep } from "@/lib/agent-reviews";
import { listCriteria } from "@/lib/criteria";
import { judgeInviteTimes } from "@/lib/email/status";
import type { JudgeDirectory, JudgingPhase } from "@/lib/data";
import { gateStatus, getGateFails } from "@/lib/gates";
import { getViewableHackathon } from "@/lib/hackathons";
import { getDistribution, getJudgingActivity, listPhases, listProjects } from "@/lib/judging";
import { listJudgeDirectory } from "@/lib/judges";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { compareRank } from "@/lib/ranking";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { JudgePhoto } from "../../setup/judges/judge-photo";
import {
  ClosePhaseButton,
  ResetJudgingButton,
  RunAgentButton,
  SampleDataButton,
  SimulateButton,
  StartJudgingButton,
} from "./progress-actions";
import { JudgeEmailButton } from "./judge-email-button";
import { PhaseFunnel } from "./phase-funnel";
import { ProgressProjects, type ProgressRow } from "./progress-projects";

/** The judges who review in a phase: its group, or everyone. */
function poolOf(phase: JudgingPhase | undefined, directory: JudgeDirectory) {
  const group = phase?.judgeGroupId ? directory.groups.find((g) => g.id === phase.judgeGroupId) : undefined;
  return group ? directory.judges.filter((j) => group.members.includes(j.id)) : directory.judges;
}

// Starting judging and "Run agent" set the agent working after the response.
export const maxDuration = 300;

export default async function ProgressPage({ params }: PageProps<"/h/[slug]/judging/progress">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [phases, projects, blocks, directory, distribution, criteria, activity] = await Promise.all([
    listPhases(hackathon.id),
    listProjects(hackathon.id),
    listSchemaBlocks(hackathon.id),
    listJudgeDirectory(hackathon.id),
    getDistribution(hackathon.id),
    listCriteria(hackathon.id),
    getJudgingActivity(hackathon.id),
  ]);

  if (!hackathon.judgingStartedAt) {
    const active = projects.filter((p) => p.status === "active").length;
    const pool = poolOf(phases[0], directory);
    const per = Math.min(phases[0]?.reviewsPerProject ?? pool.length, pool.length);
    const weights = criteria.reduce((n, c) => n + c.weight, 0);
    return (
      <NotStarted
        slug={slug}
        checks={[
          {
            ok: active > 0 ? "ok" : "fail",
            label: active > 0 ? `${active} ${active === 1 ? "project" : "projects"} ready` : "No projects yet",
            hint: active > 0 ? "Every active project goes into the first phase." : "Add them by hand, or add sample data to try it out.",
            href: `/h/${slug}/judging/projects`,
            action: blocks.length > 0 ? <SampleDataButton slug={slug} /> : undefined,
          },
          {
            ok: phases.length > 0 ? "ok" : "fail",
            label: phases.length ? phases.map((p) => p.name).join(" → ") : "No phases",
            hint: `${phases.length} ${phases.length === 1 ? "phase" : "phases"}; each narrows the pool for the next.`,
            href: `/h/${slug}/setup/phases`,
          },
          {
            ok: pool.length > 0 ? "ok" : "warn",
            label: pool.length
              ? `${pool.length} ${pool.length === 1 ? "judge" : "judges"} in ${phases[0]?.name ?? "the first phase"}`
              : "No judges in the first phase",
            hint: pool.length ? `${per} per project` : "Projects won't be assigned to anyone until there are judges.",
            href: `/h/${slug}/setup/judges`,
          },
          {
            ok: weights === 100 ? "ok" : "warn",
            label: `${criteria.length} criteria · weights add to ${weights}%`,
            hint: weights === 100 ? "The rubric judges and the agent score against." : "Weights should add to 100%.",
            href: `/h/${slug}/setup/criteria`,
          },
          {
            ok: "ok",
            label: `${distribution.agentFirst ? "Agent first" : "Judges only"} · ${distribution.strategy === "even" ? "even split" : "mixed"} · ${
              distribution.cadence === "once" ? "all at once" : `daily over ${distribution.batchDays} days`
            }`,
            hint: "How the work is handed out.",
            href: `/h/${slug}/setup/distribution`,
          },
        ]}
        summary={[
          `${active} ${active === 1 ? "project moves" : "projects move"} into ${phases[0]?.name ?? "the first phase"}.`,
          ...(distribution.agentFirst ? [`The agent's review is queued for each of them.`] : []),
          pool.length
            ? `${active * per} reviews go out to ${pool.length} ${pool.length === 1 ? "judge" : "judges"}, about ${Math.ceil((active * per) / pool.length)} each.`
            : "No reviews go out yet, since there are no judges.",
          "Setup locks: schema, criteria and phases can only be renamed, distribution can't change, and judges with reviews can't be deleted. Resetting judging unlocks it.",
        ]}
        canStart={active > 0 && phases.length > 0}
      />
    );
  }

  // ── Judging is running (or finished) ──
  const currentIdx = phases.findIndex((p) => p.startedAt && !p.closedAt);
  const current = phases[currentIdx];
  const next = phases[currentIdx + 1];
  const pool = poolOf(current, directory);
  // Every review in the running phase. Admins' own reviews count in averages,
  // but progress is measured against the judges' assignments.
  const reviewsInPhase = current ? activity.assignments.filter((a) => a.phaseId === current.id) : [];
  const inPhase = reviewsInPhase.filter((a) => a.judgeId);
  const done = inPhase.filter((a) => a.submittedAt).length;
  const agentById = new Map(activity.agentReviews.map((r) => [r.projectId, r]));
  const agentDone = activity.agentReviews.filter((r) => r.status === "done");
  const gateFailed = agentDone.filter((r) => r.gatePassed === false).length;
  const agentRunning = activity.agentReviews.filter((r) => r.status === "running").length;
  const agentQueued = activity.agentReviews.filter((r) => r.status === "queued").length;
  const [flaggedSteps, gateFails] = await Promise.all([listFlaggedSteps(hackathon.id), getGateFails(hackathon.id)]);
  // Who the agent's gate failures go to for a call (the Inbox in the top bar).
  const inbox =
    distribution.failedInbox === "admin"
      ? "your inbox"
      : (directory.judges.find((j) => j.id === distribution.inboxJudgeId)?.name ?? "nobody");

  const rows: ProgressRow[] = projects
    .map((p) => {
      const mine = inPhase.filter((a) => a.projectId === p.id);
      const scores = reviewsInPhase.filter((a) => a.projectId === p.id && a.score !== null).map((a) => a.score!);
      const { name, pitch } = projectHeadline(p, blocks);
      return {
        id: p.id,
        number: p.number,
        name,
        pitch,
        phaseName: phases.find((ph) => ph.id === p.phaseId)?.name ?? null,
        inCurrentPhase: !!current && p.phaseId === current.id,
        status: p.status,
        agent: agentById.get(p.id) ?? null,
        gate: gateStatus(gateFails.get(p.id), distribution),
        submitted: mine.filter((a) => a.submittedAt).length,
        assigned: mine.length,
        avg: scores.length ? scores.reduce((n, s) => n + s, 0) / scores.length : null,
      };
    })
    // Same order closing the phase ranks by.
    .sort((a, b) =>
      compareRank(
        { number: a.number, avg: a.avg, agentTotal: a.agent?.total ?? null, gateFailed: a.agent?.gatePassed === false || !!a.gate?.ruledOut },
        { number: b.number, avg: b.avg, agentTotal: b.agent?.total ?? null, gateFailed: b.agent?.gatePassed === false || !!b.gate?.ruledOut },
      ),
    );
  const inCurrent = rows.filter((r) => r.inCurrentPhase && r.status === "active").length;
  const out = projects.filter((p) => p.status !== "active").length;
  // Judges' gate verdicts on projects still in this phase: ruled out ones are eliminated when it closes.
  const judgeRuledOut = rows.filter((r) => r.inCurrentPhase && r.status === "active" && r.gate?.ruledOut).length;
  const judgeFlagged = rows.filter((r) => r.inCurrentPhase && r.status === "active" && r.gate && !r.gate.ruledOut).length;

  const perJudge = pool.map((j) => {
    const mine = inPhase.filter((a) => a.judgeId === j.id);
    return { judge: j, assigned: mine.length, done: mine.filter((a) => a.submittedAt).length };
  });
  const avgPct = perJudge.length ? perJudge.reduce((n, j) => n + (j.assigned ? j.done / j.assigned : 1), 0) / perJudge.length : 0;
  // When each judge's link for this phase was emailed (src/workflows/judging-phase).
  const invited = current ? await judgeInviteTimes(current.id) : new Map<string, string>();
  const withEmail = perJudge.filter((p) => p.assigned && p.judge.email).length;

  const advancing = current && next ? Math.min(current.advanceCount ?? 0, inCurrent - judgeRuledOut) : 0;
  const ruledOut = (then: string) =>
    judgeRuledOut
      ? ` ${judgeRuledOut} ${judgeRuledOut === 1 ? "project is" : "projects are"} ruled out on a gate by judges and ${then}.`
      : "";
  const closeDescription = !current
    ? ""
    : next
      ? `The top ${advancing} of ${inCurrent} advance to ${next.name} and its reviews go out. The other ${inCurrent - advancing} are eliminated.${ruledOut("can't advance, whatever the score")} Judges who haven't finished can't submit for this phase any more.`
      : `This is the last phase. Closing it ends judging and moves the hackathon to Results.${ruledOut("won't be ranked")}`;

  return (
    <div className="flex flex-col gap-12">
      <LiveRefresh active={agentRunning + agentQueued > 0} every={4000} />
      {/* The funnel sits right under the title, closer than the sections below. */}
      <div className="flex flex-col">
        <PageHeader
          title="Progress"
          actions={
            <>
              <RunAgentButton slug={slug} working={agentRunning + agentQueued > 0} />
              {current && (
                <>
                  <SimulateButton slug={slug} />
                  <ClosePhaseButton slug={slug} title={`Close ${current.name}?`} description={closeDescription} />
                </>
              )}
            </>
          }
        />

        <PhaseFunnel
          phases={phases}
          projects={projects}
          currentIdx={currentIdx}
          progress={inPhase.length ? done / inPhase.length : 0}
        />
      </div>

      {/* Live numbers for the running phase; once the last one closes they'd all read 0. */}
      {current && (
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <Stat
            label="Reviews"
            value={`${done} / ${inPhase.length}`}
            hint={inPhase.length ? `${Math.round((done / inPhase.length) * 100)}% of ${current.name}` : "none assigned"}
          />
          <Stat
            label="AI reviewed"
            value={`${agentDone.length} / ${activity.agentReviews.length}`}
            hint={
              activity.agentReviews.length
                ? [
                    agentRunning && `${agentRunning} running`,
                    agentQueued && `${agentQueued} queued`,
                    flaggedSteps.length && `${flaggedSteps.length} flagged`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "all done"
                : distribution.agentFirst
                  ? "none queued"
                  : "agent first is off"
            }
          />
          <Stat
            label="Gate failed"
            value={gateFailed + judgeRuledOut}
            hint={
              [
                gateFailed && `${gateFailed} by the agent → ${inbox}`,
                judgeRuledOut && `${judgeRuledOut} ruled out by judges`,
                judgeFlagged && `${judgeFlagged} flagged`,
              ]
                .filter(Boolean)
                .join(" · ") || "agent or judges"
            }
          />
          <Stat label="In this phase" value={inCurrent} hint={`${out} out of the running`} />
        </div>
      )}

      {current && (
        <section>
          <SectionTitle
            hint={`each judge gets a private queue${
              withEmail ? ` · ${Math.min(invited.size, withEmail)} of ${withEmail} links emailed` : ""
            }`}
          >
            Judges
          </SectionTitle>
          {perJudge.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-muted">
              No judges in this phase&apos;s pool, so nothing was assigned.{" "}
              <Link href={`/h/${slug}/setup/judges`} className="underline underline-offset-4">
                Add judges
              </Link>
            </p>
          ) : (
            <Panel className="divide-y divide-border">
              {perJudge.map(({ judge: j, assigned, done: finished }) => {
                const pct = assigned ? finished / assigned : 1;
                // Well behind the pool's average pace.
                const behind = assigned > 0 && pct < avgPct * 0.6;
                return (
                  <div key={j.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 md:grid-cols-[auto_200px_1fr_auto]">
                    <JudgePhoto name={j.name} imagePath={j.imagePath} size={28} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{j.name}</span>
                      <span className="truncate text-xs text-muted">{j.title}</span>
                    </div>
                    <div className="hidden items-center gap-3 md:flex">
                      {assigned > 0 && (
                        <Segments
                          value={finished}
                          max={assigned}
                          count={Math.min(assigned, 30)}
                          className="flex-1"
                          tone={finished === assigned ? "success" : "accent"}
                        />
                      )}
                      <span className="w-14 text-right font-pixel text-xs">
                        {finished}/{assigned}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {behind && <Badge tone="warning">behind</Badge>}
                      {assigned > 0 && (
                        <JudgeEmailButton slug={slug} judgeId={j.id} email={j.email} sentAt={invited.get(j.id) ?? null} />
                      )}
                      {j.accessToken && <JudgeLinkButtons token={j.accessToken} name={j.name} />}
                    </div>
                  </div>
                );
              })}
            </Panel>
          )}
        </section>
      )}

      {flaggedSteps.length > 0 && <NeedsAPerson steps={flaggedSteps} slug={slug} />}

      <ProgressProjects rows={rows} cutoff={next ? advancing : null} phaseName={current?.name ?? null} slug={slug} />

      <section className="flex flex-wrap items-center gap-4 border-t border-border pt-8">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">Reset judging</span>
          <span className="text-xs text-muted">
            Back to setup: assignments, scores and agent reviews are deleted. Handy while trying things out.
          </span>
        </div>
        <ResetJudgingButton slug={slug} />
      </section>
    </div>
  );
}

/** Agent verdicts waiting on a person: unsure, disagreed with, failed, or flagged by an admin. */
function NeedsAPerson({ steps, slug }: { steps: FlaggedStep[]; slug: string }) {
  return (
    <section>
      <SectionTitle hint="the agent wasn't sure, its double check disagreed, or someone flagged it">Needs a person</SectionTitle>
      <Panel className="divide-y divide-border">
        {steps.slice(0, 30).map((s) => (
          <Link
            key={s.stepId}
            href={`/h/${slug}/judging/projects/${s.projectNumber}#agent`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 transition hover:bg-surface-secondary/60"
          >
            <span className="font-pixel text-sm text-muted">{formatNumber(s.projectNumber)}</span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{s.criterionTitle}</span>
              <span className="truncate text-xs text-muted">{s.reason || "Flagged for a second look"}</span>
            </span>
            <span className="flex items-center gap-2">
              {s.failed ? (
                <Badge tone="danger">failed</Badge>
              ) : s.score !== null ? (
                <span className="font-pixel text-sm">{s.score}/10</span>
              ) : s.passed !== null ? (
                <Badge tone={s.passed ? "success" : "danger"}>{s.passed ? "pass" : "fail"}</Badge>
              ) : null}
              <PixelIcon name="arrow-right" size={10} className="text-muted" />
            </span>
          </Link>
        ))}
      </Panel>
      {steps.length > 30 && <p className="mt-2 text-xs text-muted">…and {steps.length - 30} more</p>}
    </section>
  );
}

type Check = { ok: "ok" | "warn" | "fail"; label: string; hint: string; href: string; action?: ReactNode };

function NotStarted({
  slug,
  checks,
  summary,
  canStart,
}: {
  slug: string;
  checks: Check[];
  summary: string[];
  canStart: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      <div className="flex min-w-0 flex-col">
        <PageHeader title="Progress" />

        <Panel className="divide-y divide-border">
          {checks.map((c) => (
            <div key={c.href} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md",
                  c.ok === "ok" && "bg-success-soft text-success-soft-foreground",
                  c.ok === "warn" && "bg-warning-soft text-warning-soft-foreground",
                  c.ok === "fail" && "bg-danger-soft text-danger-soft-foreground",
                )}
              >
                <PixelIcon name={c.ok === "ok" ? "check" : c.ok === "warn" ? "flag" : "x"} size={12} />
              </span>
              <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{c.label}</span>
                <span className="text-xs text-muted">{c.hint}</span>
              </span>
              {c.action}
              <Link href={c.href} className="text-sm text-muted underline decoration-border-secondary underline-offset-4 hover:text-foreground">
                Edit
              </Link>
            </div>
          ))}
        </Panel>

        <Panel className="mt-6 flex flex-col gap-4 bg-surface-secondary/40 p-6">
          <Eyebrow>When you start</Eyebrow>
          <ol className="flex flex-col gap-2 text-sm">
            {summary.map((line, i) => (
              <li key={line} className="flex gap-3">
                <span className="font-pixel text-xs text-muted">{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!canStart && <span className="text-sm text-muted">Needs at least one project and one phase.</span>}
            <StartJudgingButton slug={slug} disabled={!canStart} />
          </div>
        </Panel>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-36 lg:self-start">
        <h2 className="text-lg leading-none">How judging runs</h2>
        <ul className="flex flex-col gap-3 text-sm">
          <ExplainerItem icon="spark" title="Agent first">
            With it on, the agent reviews every project and checks the gates, starting when judging does. Judges don&apos;t wait for it.
          </ExplainerItem>
          <ExplainerItem icon="users" title="Assignments">
            Each phase&apos;s projects are split across its judges, following Distribution.
          </ExplainerItem>
          <ExplainerItem icon="arrow-right" title="Closing a phase">
            The top projects advance and the next phase&apos;s reviews go out. The rest are eliminated.
          </ExplainerItem>
          <ExplainerItem icon="trophy" title="Last phase">
            Closing it ends judging and moves you to Results.
          </ExplainerItem>
        </ul>
      </aside>
    </div>
  );
}
