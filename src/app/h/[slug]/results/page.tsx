import { notFound } from "next/navigation";
import { getAnnounceStatus } from "@/lib/email/announce";
import { getViewableHackathon } from "@/lib/hackathons";
import { getResults } from "@/lib/results";
import { Winners } from "./winners";

export default async function ResultsPage({ params }: PageProps<"/h/[slug]/results">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const results = await getResults(hackathon);
  // Only once the ranking is final: before that there's nothing to announce.
  const emailStatus = results.state === "final" ? await getAnnounceStatus(hackathon, results) : null;
  return (
    <Winners
      // Remount after a save so the draggable order starts from the server's.
      key={results.ranking.map((r) => r.id).join()}
      slug={slug}
      results={results}
      published={!!hackathon.published}
      canPublish={hackathon.stage === "results"}
      emailStatus={emailStatus}
    />
  );
}
