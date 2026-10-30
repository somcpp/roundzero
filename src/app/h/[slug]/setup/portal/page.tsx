import { notFound } from "next/navigation";
import { listCriteria } from "@/lib/criteria";
import { getViewableHackathon } from "@/lib/hackathons";
import { getPortalSettings } from "@/lib/judge-portal";
import { getDistribution, listPhases, listProjects } from "@/lib/judging";
import { listJudgeDirectory } from "@/lib/judges";
import { projectHeadline } from "@/lib/project-fields";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { PortalEditor } from "./portal-editor";

export default async function JudgePortalPage({ params, searchParams }: PageProps<"/h/[slug]/setup/portal">) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [settings, criteria, directory, distribution, phases, projects, blocks] = await Promise.all([
    getPortalSettings(hackathon.id),
    listCriteria(hackathon.id),
    listJudgeDirectory(hackathon.id),
    getDistribution(hackathon.id),
    listPhases(hackathon.id),
    listProjects(hackathon.id),
    listSchemaBlocks(hackathon.id),
  ]);

  // The preview shows a few real project names, as a judge would see them.
  const sample = projects
    .filter((p) => p.status === "active")
    .slice(0, 4)
    .map((p) => ({ id: p.id, name: projectHeadline(p, blocks).name }));
  const phase = phases.find((p) => p.startedAt && !p.closedAt) ?? phases[0];

  return (
    <PortalEditor
      initial={settings}
      slug={slug}
      initialTab={tab === "links" ? "links" : "settings"}
      judges={directory.judges.map((j) => ({
        id: j.id,
        name: j.name,
        title: j.title,
        email: j.email,
        imagePath: j.imagePath,
        accessToken: j.accessToken ?? null,
      }))}
      preview={{
        criteria: criteria.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          scale: c.scale,
          weight: c.weight,
          gate: c.gate,
        })),
        projects: sample,
        daily: distribution.cadence === "daily",
        phaseLabel: phase
          ? phases.length > 1
            ? `${phase.name} · round ${phases.indexOf(phase) + 1} of ${phases.length}`
            : phase.name
          : "Judging",
        phaseName: phase?.name ?? "this round",
      }}
    />
  );
}
