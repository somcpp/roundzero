import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { countProjects, listPhases } from "@/lib/judging";
import { listJudgeDirectory } from "@/lib/judges";
import { PhasesEditor } from "./phases-editor";

export default async function PhasesPage({ params }: PageProps<"/h/[slug]/setup/phases">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [phases, directory, counts] = await Promise.all([
    listPhases(hackathon.id),
    listJudgeDirectory(hackathon.id),
    countProjects(hackathon.id),
  ]);
  return (
    <PhasesEditor
      initial={phases}
      groups={directory.groups}
      judgeCount={directory.judges.length}
      projectCount={counts.active}
      locked={!!hackathon.judgingStartedAt}
      slug={slug}
    />
  );
}
