import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { countProjects, getDistribution, listPhases } from "@/lib/judging";
import { listJudgeDirectory } from "@/lib/judges";
import { getCurrentUser } from "@/lib/supabase/server";
import { DistributionEditor } from "./distribution-editor";

export default async function DistributionPage({ params }: PageProps<"/h/[slug]/setup/distribution">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [settings, phases, directory, counts, user] = await Promise.all([
    getDistribution(hackathon.id),
    listPhases(hackathon.id),
    listJudgeDirectory(hackathon.id),
    countProjects(hackathon.id),
    // The signed-in user is the admin, unless it's a demo account looking around.
    getCurrentUser(),
  ]);
  const admin = hackathon.readOnly
    ? { name: "Organizer", email: null }
    : { name: user?.name ?? user?.email ?? "Admin", email: user?.email ?? null };
  return (
    <DistributionEditor
      initial={settings}
      phases={phases}
      judges={directory.judges.map((j) => ({ id: j.id, name: j.name, title: j.title, imagePath: j.imagePath }))}
      admin={admin}
      groups={directory.groups}
      projectCount={counts.active}
      locked={!!hackathon.judgingStartedAt}
      slug={slug}
    />
  );
}
