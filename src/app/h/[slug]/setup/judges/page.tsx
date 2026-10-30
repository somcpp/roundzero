import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { getJudgingActivity, listPhases } from "@/lib/judging";
import { listJudgeDirectory } from "@/lib/judges";
import { JudgesDirectory } from "./judges-directory";

/** What can't be deleted once judging starts: judges with reviews, and groups that phases use. */
async function judgingLock(hackathonId: string) {
  const [phases, activity] = await Promise.all([listPhases(hackathonId), getJudgingActivity(hackathonId)]);
  return {
    reviewed: [...new Set(activity.assignments.flatMap((a) => (a.judgeId ? [a.judgeId] : [])))],
    phaseGroups: phases.flatMap((p) => (p.judgeGroupId ? [p.judgeGroupId] : [])),
  };
}

export default async function JudgesPage({ params }: PageProps<"/h/[slug]/setup/judges">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [directory, lock] = await Promise.all([
    listJudgeDirectory(hackathon.id),
    hackathon.judgingStartedAt ? judgingLock(hackathon.id) : null,
  ]);
  return <JudgesDirectory initial={directory} hackathonId={hackathon.id} slug={slug} lock={lock} />;
}
