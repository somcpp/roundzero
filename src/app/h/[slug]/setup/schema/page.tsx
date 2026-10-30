import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { SchemaEditor } from "./schema-editor";

export default async function SchemaPage({ params }: PageProps<"/h/[slug]/setup/schema">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  const blocks = await listSchemaBlocks(hackathon.id);
  return <SchemaEditor initial={blocks} slug={slug} locked={!!hackathon.judgingStartedAt} />;
}
