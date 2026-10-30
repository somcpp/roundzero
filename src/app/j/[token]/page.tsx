import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DoneScreen, StartScreen, type ScreenProject } from "@/components/judge-screens";
import { PixelIcon } from "@/components/pixel-icon";
import { ButtonLink, Eyebrow, Panel } from "@/components/ui";
import { firstName, getJudgePortal, type JudgePortal, type PortalItem } from "@/lib/judge-portal";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { Submission } from "../../h/[slug]/judging/projects/[number]/submission";
import { JudgeRail } from "./judge-rail";
import { NextBatch } from "./next-batch";
import { PortalFrame } from "./portal-frame";

// A judge's private page. No account: the token in the URL is the credential,
// and public.judge_portal() only returns that judge's own queue for the
// running phase. /j/<token> is the start screen (or "all done"), and
// ?p=<assignment id> opens one project to score.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = PageProps<"/j/[token]">;

async function load({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const p = typeof query.p === "string" && UUID.test(query.p) ? query.p : null;
  return { token, p, portal: await getJudgePortal(token, p) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { portal } = await load(props);
  return {
    title: portal ? `Judging · ${portal.hackathon.name}` : "Judging link",
    robots: { index: false, follow: false },
  };
}

const itemName = (q: PortalItem) => q.name || `Project ${formatNumber(q.number)}`;

export default async function JudgePage(props: Props) {
  const { token, p, portal } = await load(props);
  if (!portal) notFound();

  const home = `/j/${token}`;
  const href = (id: string) => `${home}?p=${id}`;
  const open = portal.queue.filter((q) => q.open);
  const later = portal.queue.filter((q) => !q.open);
  const todo = open.filter((q) => !q.submittedAt);
  const scored = open.length - todo.length;
  const daily = portal.plan?.daily ?? false;
  const first = firstName(portal.judge.name);

  const { phase } = portal;
  if (!phase || open.length === 0) {
    if (p) redirect(home);
    return (
      <PortalFrame portal={portal} home={home}>
        <Nothing portal={portal} />
      </PortalFrame>
    );
  }

  if (p) {
    const current = portal.current;
    // Not one of theirs, not open yet, or taken out of judging since.
    if (!current) redirect(home);
    const i = open.findIndex((q) => q.id === current.id);
    // The next project still to score, wrapping round to any they skipped.
    const next = [...open.slice(i + 1), ...open.slice(0, i)].find((q) => !q.submittedAt);
    const { name, pitch, nameBlockId } = projectHeadline(current, portal.blocks);
    return (
      <PortalFrame
        portal={portal}
        home={home}
        progress={{
          label: daily ? "Today" : "Project",
          done: scored,
          total: open.length,
          count: `${i + 1} / ${open.length}`,
          prevHref: i > 0 ? href(open[i - 1].id) : null,
          nextHref: i < open.length - 1 ? href(open[i + 1].id) : null,
        }}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1fr_380px]">
          <article className="flex min-w-0 flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Eyebrow>
                {formatNumber(current.number)} · {phase.name}
              </Eyebrow>
              <h1 className="text-4xl leading-none">{name}</h1>
              {pitch && <p className="text-lg text-muted">{pitch}</p>}
            </div>
            <Submission blocks={portal.blocks} values={current.values} skipBlockId={nameBlockId} />
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <JudgeRail
              key={current.id}
              token={token}
              current={current}
              criteria={portal.criteria}
              showAgentScore={portal.showAgentScore}
              nextHref={next ? href(next.id) : home}
              isLast={!next}
            />
          </aside>
        </div>
      </PortalFrame>
    );
  }

  const projects: ScreenProject[] = open.map((q) => ({
    id: q.id,
    name: itemName(q),
    done: !!q.submittedAt,
    score: q.score,
    href: href(q.id),
  }));
  const progress = { label: daily ? "Today" : "Scored", done: scored, total: open.length, count: `${scored} / ${open.length}` };

  if (todo.length === 0) {
    const nextBatch = later.length ? Math.min(...later.map((q) => q.batch)) : null;
    return (
      <PortalFrame portal={portal} home={home} progress={progress}>
        <DoneScreen
          firstName={first}
          message={portal.settings.doneMessage}
          phaseName={phase.name}
          projects={projects}
          later={later.length}
          more={
            <NextBatch
              token={token}
              count={later.filter((q) => q.batch === nextBatch).length}
              opensAt={portal.plan?.nextAt ?? null}
            />
          }
        />
      </PortalFrame>
    );
  }

  return (
    <PortalFrame portal={portal} home={home} progress={progress}>
      <StartScreen
        firstName={first}
        settings={portal.settings}
        phaseLabel={phase.count > 1 ? `${phase.name} · round ${phase.index + 1} of ${phase.count}` : phase.name}
        daily={daily}
        projects={projects}
        later={later.length}
        criteria={portal.criteria}
        cta={
          <ButtonLink href={href(todo[0].id)} size="lg">
            {scored > 0 ? "Keep going" : "Start judging"} <PixelIcon name="arrow-right" size={12} />
          </ButtonLink>
        }
      />
    </PortalFrame>
  );
}

/** No running phase, or nothing for this judge in it. */
function Nothing({ portal }: { portal: JudgePortal }) {
  const { hackathon, phase } = portal;
  const [title, body] = phase
    ? [
        "Nothing for you in this round",
        `You're not on the panel for ${phase.name}. If that seems wrong, get in touch with the organizers.`,
      ]
    : hackathon.stage === "results"
      ? ["Judging is over", `Thank you for judging ${hackathon.name}! The organizers are wrapping up the results.`]
      : !hackathon.judgingStartedAt
        ? ["Judging hasn't started yet", "Your projects will show up here as soon as it does. Keep this link handy."]
        : ["Nothing to judge right now", "The next round hasn't started yet. Check back soon."];
  return (
    <Panel className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-xl bg-surface-secondary text-muted">
        <PixelIcon name={phase || hackathon.stage !== "results" ? "calendar" : "trophy"} size={24} />
      </span>
      <h1 className="text-3xl leading-tight">{title}</h1>
      <p className="text-muted">{body}</p>
    </Panel>
  );
}
