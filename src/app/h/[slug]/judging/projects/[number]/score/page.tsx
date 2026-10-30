import Link from "next/link";
import { notFound } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { Eyebrow, Panel } from "@/components/ui";
import { listCriteria } from "@/lib/criteria";
import { getViewableHackathon } from "@/lib/hackathons";
import { getProjectWithEvents, listPhases } from "@/lib/judging";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { listProjectReviews, type ProjectReview } from "@/lib/reviews";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { getCurrentUser } from "@/lib/supabase/server";
import { ScoringRail } from "../review/[assignmentId]/scoring-rail";
import { Submission } from "../submission";

/**
 * Score a project yourself, as an admin: one more review in the phase that's
 * running, next to the assigned judges'. Theirs stay as they are.
 */
export default async function YourScorePage({ params }: PageProps<"/h/[slug]/judging/projects/[number]/score">) {
  const { slug, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [found, blocks, criteria, phases, user] = await Promise.all([
    getProjectWithEvents(hackathon.id, n),
    listSchemaBlocks(hackathon.id),
    listCriteria(hackathon.id),
    listPhases(hackathon.id),
    getCurrentUser(),
  ]);
  if (!found || !user) notFound();
  const { project } = found;
  const reviews = await listProjectReviews(hackathon.id, project.id);

  const { name, pitch, nameBlockId } = projectHeadline(project, blocks);
  const base = `/h/${slug}/judging/projects/${project.number}`;
  const phase = phases.find((p) => p.id === project.phaseId);
  const running = !!phase?.startedAt && !phase.closedAt && project.status === "active";
  const inPhase = phase ? reviews.filter((r) => r.phase.id === phase.id) : [];
  const mine = inPhase.find((r) => r.admin?.id === user.id);
  const judged = inPhase.filter((r) => r.judge);

  const back = (
    <Link href={base} className="mb-6 flex items-center gap-2 self-start text-sm text-muted hover:text-foreground">
      <PixelIcon name="arrow-left" size={10} /> {formatNumber(project.number)} · {name}
    </Link>
  );

  if (!phase || (!running && !mine)) {
    return (
      <div className="flex flex-col">
        {back}
        <Panel className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-surface-secondary text-muted">
            <PixelIcon name="lock" size={20} />
          </span>
          <h1 className="text-2xl">Nothing to score right now</h1>
          <p className="max-w-md text-muted">
            {project.status !== "active"
              ? `${name} is out of the running, so it doesn't need more scores.`
              : phase
                ? `You can add your own score while ${phase.name} is running.`
                : `You can add your own score once ${name} is in a running phase.`}
          </p>
        </Panel>
      </div>
    );
  }

  // Before the first submit there's no review yet; the rail starts empty.
  const review: ProjectReview = mine ?? {
    id: "new",
    projectId: project.id,
    phase: { id: phase.id, name: phase.name, position: phases.indexOf(phase), running },
    judge: null,
    admin: { id: user.id, name: user.name || user.email || "You" },
    total: null,
    submittedAt: null,
    submittedBy: null,
    notes: "",
    scores: {},
  };

  return (
    <div className="flex flex-col">
      {back}

      <div className="mb-10 flex flex-wrap items-center gap-4 rounded-xl border-2 border-accent/40 bg-accent-soft px-5 py-4 text-accent-soft-foreground">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <PixelIcon name="crown" size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-pixel text-xs tracking-wide uppercase">Your score · admin</span>
          <span className="text-sm">
            Your review is one more score in {phase.name}&apos;s average
            {judged.length > 0 &&
              `, next to ${judged.length} assigned ${judged.length === 1 ? "judge" : "judges"}`}
            . It doesn&apos;t change anyone else&apos;s, and it&apos;s logged to the audit trail under your name.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
        <article className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>
              {formatNumber(project.number)} · {phase.name}
            </Eyebrow>
            <h1 className="text-4xl leading-none">{name}</h1>
            {pitch && <p className="text-lg text-muted">{pitch}</p>}
          </div>
          <Submission blocks={blocks} values={project.values} skipBlockId={nameBlockId} />
        </article>

        <aside className="lg:sticky lg:top-36 lg:self-start">
          {/* Keyed by project, not review: the first submit turns "new" into a real id, and the rail should keep its "Saved" note. */}
          <ScoringRail key={project.id} review={review} criteria={criteria} slug={slug} projectHref={base} own />
        </aside>
      </div>
    </div>
  );
}
