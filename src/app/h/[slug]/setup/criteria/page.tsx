import { notFound } from "next/navigation";
import { TIER_MODEL_IDS } from "@/lib/ai";
import { listCriteria } from "@/lib/criteria";
import { getViewableHackathon } from "@/lib/hackathons";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { CriteriaEditor } from "./criteria-editor";

export default async function CriteriaPage({ params }: PageProps<"/h/[slug]/setup/criteria">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const [criteria, blocks] = await Promise.all([listCriteria(hackathon.id), listSchemaBlocks(hackathon.id)]);
  return (
    <CriteriaEditor
      initial={criteria}
      blocks={blocks}
      slug={slug}
      models={TIER_MODEL_IDS}
      locked={!!hackathon.judgingStartedAt}
    />
  );
}
