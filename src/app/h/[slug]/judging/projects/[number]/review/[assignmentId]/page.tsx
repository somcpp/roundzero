import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { Eyebrow, cn } from "@/components/ui";
import { listCriteria } from "@/lib/criteria";
import { getViewableHackathon } from "@/lib/hackathons";
import { getProjectWithEvents } from "@/lib/judging";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { listProjectReviews } from "@/lib/reviews";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { getCurrentUser } from "@/lib/supabase/server";
import { JudgePhoto } from "../../../../../setup/judges/judge-photo";
import { Submission } from "../../submission";
import { ScoringRail } from "./scoring-rail";

/**
 * An admin's view of one judge's review of a project: the submission as the
 * judge sees it, and a scoring rail to submit on the judge's behalf.
 */
export default async function JudgeViewPage({
  params,
}: PageProps<"/h/[slug]/judging/projects/[number]/review/[assignmentId]">) {
  const { slug, number, assignmentId } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [found, blocks, criteria, user] = await Promise.all([
    getProjectWithEvents(hackathon.id, n),
    listSchemaBlocks(hackathon.id),
    listCriteria(hackathon.id),
    getCurrentUser(),
  ]);
  if (!found) notFound();
  const { project } = found;
  const reviews = await listProjectReviews(hackathon.id, project.id);
  const review = reviews.find((r) => r.id === assignmentId);
  if (!review) notFound();

  const { name, pitch, nameBlockId } = projectHeadline(project, blocks);
  const base = `/h/${slug}/judging/projects/${project.number}`;
  // An admin's own review has its own page.
  if (!review.judge) redirect(`${base}/score`);
  const judge = review.judge;
  const panel = reviews.filter((r) => r.phase.id === review.phase.id && r.judge);
  const adminName = user?.name || user?.email || "you";

  return (
    <div className="flex flex-col">
      <Link href={base} className="mb-6 flex items-center gap-2 self-start text-sm text-muted hover:text-foreground">
        <PixelIcon name="arrow-left" size={10} /> {formatNumber(project.number)} · {name}
      </Link>

      <div className="mb-10 flex flex-wrap items-center gap-4 rounded-xl border-2 border-accent/40 bg-accent-soft px-5 py-4 text-accent-soft-foreground">
        <JudgePhoto name={judge.name} imagePath={judge.imagePath} size={40} className="rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-pixel text-xs tracking-wide uppercase">Judge view</span>
          <span className="text-[15px] font-semibold text-foreground">
            {judge.name}
            {judge.title && <span className="font-normal text-muted"> · {judge.title}</span>}
          </span>
          <span className="text-sm">
            Scores you submit here count as {judge.name}&apos;s, and the audit trail records they were entered
            by {adminName}.
            {judge.accessToken && (
              <>
                {" "}
                They can also score it themselves from{" "}
                <a
                  href={`/j/${judge.accessToken}?p=${review.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  their judge link <PixelIcon name="external" size={10} />
                </a>
                .
              </>
            )}
          </span>
        </div>
        {panel.length > 1 && (
          <nav className="flex items-center gap-1" aria-label="Other judges on this project">
            {panel.map((r) => (
              <Link
                key={r.id}
                href={`${base}/review/${r.id}`}
                title={`${r.judge!.name}${r.submittedAt ? " · scored" : ""}`}
                aria-current={r.id === review.id ? "page" : undefined}
                className={cn(
                  "relative rounded-md ring-offset-2 ring-offset-accent-soft transition",
                  r.id === review.id ? "ring-2 ring-accent" : "opacity-60 hover:opacity-100",
                )}
              >
                <JudgePhoto name={r.judge!.name} imagePath={r.judge!.imagePath} size={28} />
                {r.submittedAt && (
                  <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-success text-white">
                    <PixelIcon name="check" size={7} />
                  </span>
                )}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
        <article className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>
              {formatNumber(project.number)} · {review.phase.name}
            </Eyebrow>
            <h1 className="text-4xl leading-none">{name}</h1>
            {pitch && <p className="text-lg text-muted">{pitch}</p>}
          </div>
          <Submission blocks={blocks} values={project.values} skipBlockId={nameBlockId} />
        </article>

        <aside className="lg:sticky lg:top-36 lg:self-start">
          <ScoringRail
            key={review.id}
            review={review}
            criteria={criteria}
            slug={slug}
            projectHref={base}
          />
        </aside>
      </div>
    </div>
  );
}
