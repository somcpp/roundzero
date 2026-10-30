import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { buttonVariants } from "@heroui/styles";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, ButtonLink, cn } from "@/components/ui";
import { getAgentReview } from "@/lib/agent-reviews";
import { sandboxStatus } from "@/lib/agent/sandbox";
import { TIER_MODEL_IDS } from "@/lib/ai";
import { listCriteria } from "@/lib/criteria";
import type { ProjectEvent, RewardTier } from "@/lib/data";
import { describeGateFails, getProjectGateStatus } from "@/lib/gates";
import { getViewableHackathon } from "@/lib/hackathons";
import { getProjectWithEvents, listPhases } from "@/lib/judging";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { getProjectWins } from "@/lib/results";
import { getAgentResult, listProjectReviews } from "@/lib/reviews";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { StatusBadge } from "../status-badge";
import { AgentReview } from "./agent-review";
import { EditProjectButton, LocalTime, NoteComposer, ProjectSettings } from "./project-controls";
import { JudgeScores, ScoresPanel } from "./scores-panel";
import { Submission } from "./submission";
import { WinnerBanner, listNames } from "./winner-banner";

// The agent's runs start from this page and carry on after the response.
export const maxDuration = 800;

export default async function ProjectPage({ params }: PageProps<"/h/[slug]/judging/projects/[number]">) {
  const { slug, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [found, blocks, phases, criteria] = await Promise.all([
    getProjectWithEvents(hackathon.id, n),
    listSchemaBlocks(hackathon.id),
    listPhases(hackathon.id),
    listCriteria(hackathon.id),
  ]);
  if (!found) notFound();
  const { project, events } = found;
  const [reviews, agent, agentReview, wins, gate] = await Promise.all([
    listProjectReviews(hackathon.id, project.id),
    getAgentResult(project.id),
    getAgentReview(project.id),
    getProjectWins(hackathon.id, project),
    getProjectGateStatus(hackathon.id, project.id),
  ]);
  const { name, nameBlockId } = projectHeadline(project, blocks);
  const sandbox = sandboxStatus();
  const phaseIdx = phases.findIndex((p) => p.id === project.phaseId);
  const phase = phases[phaseIdx];
  // While the project's phase runs, an admin can add their own score to it (not a demo viewer).
  const scorePhase =
    !hackathon.readOnly && project.status === "active" && phase?.startedAt && !phase.closedAt
      ? { id: phase.id, name: phase.name }
      : null;
  const won = wins.tiers.length > 0;
  // Once there's a final ranking, "in the running" says less than the place it got.
  const ranked = project.status === "active" && project.finalRank !== null;
  const standing = standingWins(events, wins.tiers, project.finalRank);
  // The winners page lists finalists and award winners, and never disqualified projects.
  const onPublicPage =
    project.status !== "disqualified" && (project.finalRank !== null || wins.tiers.some((t) => t.recipients === "award"));

  return (
    <div className="flex flex-col">
      <Link
        href={`/h/${slug}/judging/projects`}
        className="mb-6 flex items-center gap-2 self-start text-sm text-muted hover:text-foreground"
      >
        <PixelIcon name="arrow-left" size={10} /> Projects
      </Link>

      <div className="mb-10 flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-4xl leading-none">{name}</h1>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
            <span className="font-pixel">{formatNumber(project.number)}</span>
            <span aria-hidden>·</span>
            <span>
              {phase ? `${phase.name} · phase ${phaseIdx + 1} of ${phases.length}` : "Not in a phase"}
            </span>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {won && (
            <Badge tone="accent">
              <PixelIcon name="trophy" size={10} /> winner
            </Badge>
          )}
          {ranked && !won && <Badge>final rank #{project.finalRank}</Badge>}
          {!ranked && <StatusBadge status={project.status} />}
          {gate && project.status === "active" && (
            <Badge tone={gate.ruledOut ? "danger" : "warning"} title={describeGateFails(gate.fails)}>
              {gate.ruledOut ? "ruled out · gate" : "gate flagged"}
            </Badge>
          )}
          {onPublicPage ? (
            <ButtonLink
              href={`/w/${slug}#project-${project.number}`}
              target="_blank"
              variant="secondary"
              title={hackathon.published ? "Open it on the public winners page" : "Preview it on the winners page. It isn't published yet."}
            >
              <PixelIcon name="globe" size={12} /> Public page
            </ButtonLink>
          ) : (
            <span
              aria-disabled
              title="Only finalists and award winners appear on the public winners page."
              className={cn(buttonVariants({ variant: "secondary" }), "cursor-not-allowed opacity-50")}
            >
              <PixelIcon name="globe" size={12} /> Public page
            </span>
          )}
          <EditProjectButton project={project} name={name} blocks={blocks} slug={slug} />
          <ProjectSettings project={project} phases={phases} name={name} slug={slug} />
        </div>
      </div>

      {won && (
        <WinnerBanner wins={wins} slug={slug} published={!!hackathon.published} final={hackathon.stage === "results"} />
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-12">
          <section>
            <h2 className="mb-4 text-lg leading-none">Submission</h2>
            <Submission blocks={blocks} values={project.values} skipBlockId={nameBlockId} contactEmail={project.contactEmail} />
          </section>

          <JudgeScores
            reviews={reviews}
            criteria={criteria}
            gate={gate}
            scorePhase={scorePhase}
            base={`/h/${slug}/judging/projects/${project.number}`}
          />

          <AgentReview
            slug={slug}
            projectId={project.id}
            projectName={name}
            review={agentReview}
            criteria={criteria}
            models={TIER_MODEL_IDS}
            sandboxOff={sandbox.ok ? null : sandbox.reason}
          />

          <section>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg leading-none">Audit trail</h2>
              <span className="text-sm text-muted">newest first</span>
            </div>
            <div className="mb-8">
              <NoteComposer projectId={project.id} slug={slug} />
            </div>
            <ol className="relative flex flex-col gap-7 before:absolute before:top-2 before:bottom-2 before:left-[6px] before:w-px before:bg-border">
              {events.map((e) => {
                const prizes = standing.get(e.id);
                return (
                  <li key={e.id} className="relative grid grid-cols-[14px_1fr] gap-5">
                    {prizes ? (
                      <span className="lip relative z-10 -ml-1 mt-3 grid size-[21px] place-items-center rounded-[5px] bg-accent text-accent-foreground">
                        <PixelIcon name="trophy" size={12} />
                      </span>
                    ) : (
                      <span className={cn("relative z-10 mt-1.5 size-[13px] rounded-[3px] border-2 bg-background", dotClass(e))} />
                    )}
                    <Event e={e} prizes={prizes} />
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-36 lg:self-start">
          <ScoresPanel reviews={reviews} criteria={criteria} agent={agent} agentFlagged={agentReview?.flagged ?? 0} />
        </aside>
      </div>
    </div>
  );
}

function dotClass(e: ProjectEvent) {
  switch (e.kind) {
    case "submitted":
      return "border-accent";
    case "moved":
      return e.data.forward ? "border-success bg-success" : "border-foreground";
    case "reinstated":
      return "border-success";
    case "ranked":
    case "awarded":
      return "border-accent bg-accent";
    case "agent_scored":
    case "agent_rescored":
      return e.data.gate_passed === false || e.data.failed ? "border-danger" : "border-accent";
    case "agent_overridden":
      return "border-accent bg-accent";
    case "agent_flagged":
      return e.data.flagged ? "border-warning bg-warning" : "border-success";
    case "agent_gate_decided":
      return e.data.decision === "overturned" ? "border-success bg-success" : e.data.decision ? "border-danger" : "border-foreground";
    case "eliminated":
      return "border-warning bg-warning";
    case "disqualified":
      return "border-danger bg-danger";
    default:
      return "border-foreground";
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
/** An agent verdict from the trail's data: a score or pass/fail. */
const verdictText = (v: unknown) => (typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "pass" : "fail") : undefined);

/**
 * The trail's entries that still stand as wins, keyed by event id with the
 * prizes each one brought: the ranking that set the project's current place,
 * when that place collects a prize, and the latest pick for each award it
 * holds. Anything before the last reset is history.
 */
function standingWins(events: ProjectEvent[], prizes: RewardTier[], finalRank: number | null) {
  const standing = new Map<string, RewardTier[]>();
  const rankPrizes = prizes.filter((t) => t.recipients === "ranks");
  const awards = new Map(prizes.filter((t) => t.recipients === "award").map((t) => [t.name, t]));
  let rankSeen = false;
  // Newest first.
  for (const e of events) {
    if (e.kind === "judging_reset") break;
    if (e.kind === "ranked" && !rankSeen) {
      rankSeen = true;
      if (e.data.rank === finalRank && rankPrizes.length) standing.set(e.id, rankPrizes);
    } else if (e.kind === "awarded") {
      const tier = awards.get(str(e.data.award));
      if (tier) {
        standing.set(e.id, [tier]);
        awards.delete(tier.name);
      }
    }
  }
  return standing;
}

function Event({ e, prizes }: { e: ProjectEvent; prizes?: RewardTier[] }) {
  const by = e.actorName || (e.actorKind === "agent" ? "Agent" : "Someone");
  const note = str(e.data.note);
  switch (e.kind) {
    case "submitted":
      if (e.data.via === "api") return <Entry title="Submitted" e={e} detail="Imported through the API" />;
      if (e.data.via === "form") return <Entry title="Submitted" e={e} detail="Sent in through the submission form" />;
      return <Entry title="Submitted" e={e} detail={`Added by ${by}`} />;
    case "edited": {
      const fields = Array.isArray(e.data.fields) ? (e.data.fields as string[]) : [];
      return <Entry title="Edited" e={e} detail={`${by} changed ${fields.join(", ") || "the submission"}`} />;
    }
    case "moved": {
      const to = str(e.data.to);
      const from = str(e.data.from);
      const title = !to ? "Taken out of judging" : !from ? `Moved into ${to}` : e.data.forward ? `Advanced to ${to}` : `Moved back to ${to}`;
      return <Entry title={title} e={e} detail={from && to ? `from ${from} · by ${by}` : `by ${by}`} />;
    }
    case "eliminated":
      return <Entry title="Eliminated" e={e} detail={`by ${by}`} quote={note} />;
    case "disqualified":
      return <Entry title="Disqualified" e={e} detail={`by ${by}`} quote={note} />;
    case "reinstated":
      return <Entry title="Reinstated" e={e} detail={`by ${by}`} />;
    case "note":
      return <Entry title={`${by} added a note`} e={e} quote={note} />;
    case "judge_scored":
      if (e.data.on_behalf) return <JudgeScoredOnBehalf e={e} by={by} />;
      if (e.data.admin_review) return <AdminScored e={e} by={by} />;
      if (e.data.via === "link") return <JudgeScoredViaLink e={e} by={by} />;
    // falls through: the demo's simulated judges.
    case "agent_scored": {
      const total = typeof e.data.total === "number" ? e.data.total.toFixed(1) : undefined;
      const gateFailed = e.data.gate_passed === false;
      const flagged = typeof e.data.flagged === "number" ? e.data.flagged : 0;
      const detail = [
        gateFailed && "Failed a gate, so it goes to the agent-failed inbox",
        flagged > 0 && `${flagged} ${flagged === 1 ? "step needs" : "steps need"} a person`,
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <Entry
          title={`${e.kind === "agent_scored" ? "Agent" : by} scored`}
          e={e}
          extra={total}
          detail={detail || undefined}
          quote={note}
        />
      );
    }
    case "agent_rescored": {
      const to = verdictText(e.data.to);
      return (
        <Entry
          title={`Agent re-ran ${str(e.data.criterion)}`}
          e={e}
          extra={e.data.failed ? undefined : to}
          detail={
            e.data.failed
              ? `Asked by ${by}; the step failed`
              : `Asked by ${by} · was ${verdictText(e.data.from) ?? "–"}${e.data.flagged ? " · needs a person" : ""}`
          }
          quote={str(e.data.guidance)}
        />
      );
    }
    case "agent_overridden":
      return e.data.cleared ? (
        <Entry title={`Override cleared on ${str(e.data.criterion)}`} e={e} detail={`by ${by} · the agent's ${verdictText(e.data.agent) ?? "verdict"} counts again`} />
      ) : (
        <Entry
          title={`${str(e.data.criterion)} overridden`}
          e={e}
          extra={verdictText(e.data.to)}
          detail={`by ${by} · the agent said ${verdictText(e.data.agent) ?? "–"}${typeof e.data.total === "number" ? ` · agent total now ${e.data.total.toFixed(1)}` : ""}`}
          quote={note}
        />
      );
    case "agent_flagged":
      return e.data.flagged ? (
        <Entry title={`${str(e.data.criterion)} flagged for a person`} e={e} detail={`by ${by}`} quote={note} />
      ) : (
        <Entry title={`${str(e.data.criterion)} checked`} e={e} detail={`${by} agreed with the agent`} />
      );
    case "ranked": {
      const from = typeof e.data.from === "number" ? ` (was #${e.data.from})` : "";
      return typeof e.data.rank === "number" ? (
        <Entry
          title={`Final rank #${e.data.rank}`}
          e={e}
          won={prizes && `Won ${listNames(prizes.map((t) => t.name))}`}
          detail={`${from ? `Moved by ${by}${from}` : "When the last phase closed"}`}
        />
      ) : (
        <Entry title="Taken out of the final ranking" e={e} detail={`by ${by}`} />
      );
    }
    case "awarded":
      return <Entry title={`Won ${str(e.data.award)}`} e={e} won={!!prizes} detail={`Picked by ${by}`} />;
    case "award_removed":
      return <Entry title={`Removed from ${str(e.data.award)}`} e={e} detail={`by ${by}`} />;
    case "judging_reset":
      return <Entry title="Judging reset" e={e} detail={`by ${by} · back to no phase`} />;
    case "agent_gate_decided": {
      // A call from the agent-failed inbox on a gate the agent failed.
      const gates = str(e.data.gates);
      if (!e.data.decision) {
        return <Entry title="Agent gate call undone" e={e} detail={`by ${by} · back in the inbox`} />;
      }
      return e.data.decision === "overturned" ? (
        <Entry
          title="Agent gate failure overturned"
          e={e}
          detail={`${by} disagreed with the agent${gates && ` on ${gates}`} · back in the pool`}
          quote={note}
        />
      ) : (
        <Entry
          title="Agent gate failure upheld"
          e={e}
          detail={`${by} agreed with the agent${gates && ` on ${gates}`}${e.data.eliminated ? " · eliminated" : " · ranks last, can't win"}`}
          quote={note}
        />
      );
    }
  }
}

function Entry({
  title,
  e,
  detail,
  quote,
  extra,
  won,
}: {
  title: string;
  e: ProjectEvent;
  detail?: ReactNode;
  quote?: string;
  extra?: string;
  /** A win that still stands: highlights the entry, with a line saying what it won when that isn't the title. */
  won?: boolean | string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", won && "rounded-lg bg-accent-soft/60 px-3.5 py-3")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-pixel text-[15px]">{title}</span>
        <span className="text-xs text-muted">
          <LocalTime iso={e.createdAt} />
        </span>
        {extra && <span className="ml-auto font-pixel text-sm">{extra}</span>}
      </div>
      {typeof won === "string" && <span className="text-sm font-medium text-accent-soft-foreground">{won}</span>}
      {detail && <span className="text-sm text-muted">{detail}</span>}
      {quote && <blockquote className="border-l-2 border-border-secondary pl-3 text-sm whitespace-pre-wrap">{quote}</blockquote>}
    </div>
  );
}

/** A judge scoring from their own link. */
function JudgeScoredViaLink({ e, by }: { e: ProjectEvent; by: string }) {
  const total = typeof e.data.total === "number" ? e.data.total.toFixed(1) : undefined;
  const phase = str(e.data.phase);
  const title = e.data.adjusted
    ? `${by} changed their score`
    : e.data.resubmitted
      ? `${by} updated their score`
      : `${by} scored`;
  return (
    <Entry
      title={title}
      e={e}
      extra={total}
      detail={
        <>
          From their judge link{phase && ` · ${phase}`}
          {e.data.adjusted === true && " · after seeing the agent's score"}
          {e.data.gate_passed === false && " · failed a gate"}
          {typeof e.data.signed_in_as === "string" && (
            <span className="mt-0.5 block font-mono text-[11px]" title="Someone signed in submitted from the judge's link">
              opened by user {e.data.signed_in_as}
            </span>
          )}
        </>
      }
      quote={str(e.data.note)}
    />
  );
}

/** An admin's own review: one more score for the phase, on top of the judges'. */
function AdminScored({ e, by }: { e: ProjectEvent; by: string }) {
  const phase = str(e.data.phase);
  if (e.data.removed) {
    return <Entry title={`${by} removed their own score`} e={e} detail={`Admin review${phase && ` · ${phase}`} · no longer in the average`} />;
  }
  const total = typeof e.data.total === "number" ? e.data.total.toFixed(1) : undefined;
  return (
    <Entry
      title={e.data.resubmitted ? `${by} updated their own score` : `${by} added their own score`}
      e={e}
      extra={total}
      detail={
        <>
          Admin review{phase && ` · ${phase}`} · counts next to the judges&apos;
          {e.data.gate_passed === false && " · failed a gate"}
        </>
      }
      quote={str(e.data.note)}
    />
  );
}

/** A judge's score an admin entered for them: who, for whom, and the admin's user id. */
function JudgeScoredOnBehalf({ e, by }: { e: ProjectEvent; by: string }) {
  const total = typeof e.data.total === "number" ? e.data.total.toFixed(1) : undefined;
  const judge = str(e.data.judge_name) || "a judge";
  const phase = str(e.data.phase);
  return (
    <Entry
      title={`${e.data.resubmitted ? "Score updated" : "Scored"} for ${judge}`}
      e={e}
      extra={total}
      detail={
        <>
          Entered by {by} (admin){phase && ` · ${phase}`}
          {e.data.gate_passed === false && " · failed a gate"}
          {e.actorId && (
            <span className="mt-0.5 block font-mono text-[11px]" title="Admin's user id">
              user {e.actorId}
            </span>
          )}
        </>
      }
      quote={str(e.data.note)}
    />
  );
}
