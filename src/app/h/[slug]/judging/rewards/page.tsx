import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { listCriteria } from "@/lib/criteria";
import { listPhases } from "@/lib/judging";
import { getResults } from "@/lib/results";
import { getRewardEmail } from "@/lib/reward-emails";
import { getRewardSettings, listRewardTiers } from "@/lib/rewards";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { getThankYouEmail, getThankYouStats } from "@/lib/thank-you-emails";
import { RewardsEditor, type RewardsTab } from "./rewards-editor";

export default async function RewardsPage({ params, searchParams }: PageProps<"/h/[slug]/judging/rewards">) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  // The thank-you preview's winners and numbers are only for show, so a failed read falls back to samples.
  const [tiers, criteria, email, thankYou, settings, blocks, results, stats, phases, h] = await Promise.all([
    listRewardTiers(hackathon.id),
    listCriteria(hackathon.id),
    getRewardEmail(hackathon.id),
    getThankYouEmail(hackathon.id),
    getRewardSettings(hackathon.id),
    listSchemaBlocks(hackathon.id),
    getResults(hackathon).catch(() => null),
    getThankYouStats(hackathon.id).catch(() => ({ projects: 0, judges: 0, reviews: 0 })),
    listPhases(hackathon.id).catch(() => []),
    headers(),
  ]);
  // The emails link to the public winners page, at the address this app is served from.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  return (
    <RewardsEditor
      initial={tiers}
      initialEmail={email}
      initialThankYou={thankYou}
      initialSettings={settings}
      initialTab={tab === "winner-email" || tab === "thank-you-email" ? (tab satisfies RewardsTab) : "prizes"}
      hasTeamField={blocks.some((b) => b.type === "team")}
      hackathon={{
        name: hackathon.name,
        slug: hackathon.slug,
        logo: hackathon.logo,
        logoUrl: hackathon.logoUrl,
        color: hackathon.color,
      }}
      thankYouPreview={{
        stats,
        winners: (results?.winners ?? []).map((w) => ({
          id: w.project.id,
          name: w.project.name,
          pitch: w.project.pitch,
          rank: w.rank,
          prize: w.tiers.map((t) => t.name).join(" + "),
        })),
        milestone: phases.length > 1 ? `Reached round ${phases.length} of ${phases.length}` : null,
      }}
      winnersUrl={`${host ? `${proto}://${host}` : ""}/w/${hackathon.slug}`}
      criteria={criteria.map((c) => ({ id: c.id, title: c.title }))}
      hackathonId={hackathon.id}
      slug={slug}
    />
  );
}
