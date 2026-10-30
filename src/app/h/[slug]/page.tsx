import { notFound, redirect } from "next/navigation";
import { STAGE_HOME } from "@/lib/data";
import { getViewableHackathon } from "@/lib/hackathons";

export default async function HackathonIndex({ params }: PageProps<"/h/[slug]">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  redirect(`/h/${slug}/${STAGE_HOME[hackathon.stage]}`);
}
