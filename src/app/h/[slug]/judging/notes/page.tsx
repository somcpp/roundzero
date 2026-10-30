import { notFound } from "next/navigation";
import { rules } from "@/lib/data";
import { AgentNotes } from "./agent-notes";

// Hidden for now: the tab is gone from the nav and the page 404s. Drop this
// flag and re-add { label: "Agent notes", href: "judging/notes" } to the
// Judging subnav in components/hackathon-nav.tsx to bring it back.
const HIDDEN = true;

export default async function NotesPage({ params }: PageProps<"/h/[slug]/judging/notes">) {
  if (HIDDEN) notFound();
  const { slug } = await params;
  return <AgentNotes initial={rules} slug={slug} />;
}
