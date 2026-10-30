import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { getIntakeSettings } from "@/lib/intake";
import { getJudgingActivity, listPhases, listProjects } from "@/lib/judging";
import { average } from "@/lib/ranking";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { ProjectsList, type ProjectScore } from "./projects-list";

export default async function ProjectsPage({ params }: PageProps<"/h/[slug]/judging/projects">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [projects, blocks, phases, activity, intake, h] = await Promise.all([
    listProjects(hackathon.id),
    listSchemaBlocks(hackathon.id),
    listPhases(hackathon.id),
    getJudgingActivity(hackathon.id),
    getIntakeSettings(hackathon.id),
    headers(),
  ]);

  // Judge average from the latest phase with submitted scores, like the
  // project page shows; the agent's total until any judge has scored.
  const order = new Map(phases.map((p, i) => [p.id, i]));
  const agent = new Map(activity.agentReviews.map((r) => [r.projectId, r.total]));
  const scores: Record<string, ProjectScore> = {};
  for (const p of projects) {
    const scored = activity.assignments.filter((a) => a.projectId === p.id && a.score !== null);
    const latest = scored.reduce<string | null>(
      (best, a) => (best === null || (order.get(a.phaseId) ?? -1) > (order.get(best) ?? -1) ? a.phaseId : best),
      null,
    );
    const avg = average(scored.filter((a) => a.phaseId === latest).map((a) => a.score!));
    const agentTotal = agent.get(p.id) ?? null;
    if (avg !== null) scores[p.id] = { value: avg, source: "judges" };
    else if (agentTotal !== null) scores[p.id] = { value: agentTotal, source: "agent" };
  }

  // The public URL the intake API and form are reached at, for the drawers' copy buttons.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return (
    <ProjectsList
      projects={projects}
      blocks={blocks}
      phases={phases}
      scores={scores}
      slug={slug}
      intake={{
        settings: intake,
        origin: `${proto}://${host}`,
        hackathonName: hackathon.name,
        judgingStarted: !!hackathon.judgingStartedAt,
      }}
    />
  );
}
