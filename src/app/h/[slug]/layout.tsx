import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { BrandScope } from "@/components/brand-scope";
import { HackathonNav } from "@/components/hackathon-nav";
import { DemoBanner, ReadOnlyProvider } from "@/components/read-only";
import { getFailedInboxSummary } from "@/lib/failed-inbox";
import { getViewableHackathon } from "@/lib/hackathons";

export default async function HackathonLayout({ children, params }: LayoutProps<"/h/[slug]">) {
  const { slug } = await params;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();
  // The Inbox button's count: agent gate failures waiting on a call, once judging starts.
  const failedInbox = hackathon.judgingStartedAt ? await getFailedInboxSummary(hackathon.id) : null;
  const readOnly = !!hackathon.readOnly;

  return (
    <div className="brand flex flex-1 flex-col has-[[data-bleed]]:max-h-dvh" style={{ "--brand": hackathon.color } as CSSProperties}>
      <BrandScope color={hackathon.color} />
      <ReadOnlyProvider value={readOnly}>
        {readOnly && <DemoBanner>Demo hackathon. Try anything you like; nothing you change is saved.</DemoBanner>}
        <HackathonNav hackathon={hackathon} failedInbox={failedInbox} />
        {/* A page whose root has data-bleed (e.g. the chat) fills the screen below the nav, edge to edge. */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 sm:py-10 has-[>[data-bleed]]:flex has-[>[data-bleed]]:min-h-0 has-[>[data-bleed]]:max-w-none has-[>[data-bleed]]:p-0">
          {children}
        </main>
      </ReadOnlyProvider>
    </div>
  );
}
