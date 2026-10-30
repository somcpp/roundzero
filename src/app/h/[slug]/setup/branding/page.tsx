import { notFound } from "next/navigation";
import { getViewableHackathon } from "@/lib/hackathons";
import { BrandingEditor } from "./branding-editor";

export default async function BrandingPage({ params }: PageProps<"/h/[slug]/setup/branding">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  return <BrandingEditor hackathon={hackathon} />;
}
