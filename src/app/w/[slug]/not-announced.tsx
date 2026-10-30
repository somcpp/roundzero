import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { Eyebrow, LogoMark, PixelCover } from "@/components/ui";
import { brand } from "@/lib/branding";
import type { Hackathon } from "@/lib/data";

/** The dashed "nothing here yet" box the winners page shows in place of winners. */
export function WaitingNotice({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-16 text-center">
      <PixelIcon name="trophy" size={20} className="text-muted" />
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-md text-sm text-muted">{children}</p>
    </section>
  );
}

/** Where judging is up to, for someone waiting on the winners. */
function stageNotice(h: Hackathon) {
  if (h.stage === "setup" || !h.judgingStartedAt) {
    return {
      title: "Judging hasn't started yet",
      body: "Winners will be posted here once the judges have made their picks.",
    };
  }
  if (h.stage === "judging") {
    const phase = h.currentPhase;
    return {
      title: "Judging is under way",
      body: phase
        ? `Judging is in ${phase.name} (phase ${phase.index + 1} of ${phase.count}). Winners will be posted here once the judges are done.`
        : "The judges are still deciding. Winners will be posted here once they're done.",
    };
  }
  return {
    title: "Winners are on their way",
    body: "Judging is finished. Winners will be posted here once the organizers announce them.",
  };
}

/**
 * /w/[slug] before its results are public. Someone who can see the hackathon
 * (a demo account) gets its branding and where judging is up to. Anyone else
 * gets the same page for an unpublished hackathon as for a slug that doesn't
 * exist, so the URL doesn't tell them which it is.
 */
export function NotAnnounced({ hackathon }: { hackathon: Hackathon | null }) {
  if (!hackathon) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-xl bg-surface-secondary text-muted">
            <PixelIcon name="trophy" size={24} />
          </span>
          <h1 className="text-3xl">No winners here yet</h1>
          <p className="max-w-md text-muted">
            This hackathon hasn&apos;t announced its winners. Check back once judging is done.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const { title, body } = stageNotice(hackathon);
  return (
    <div className="brand flex min-h-screen flex-col" style={{ "--brand": hackathon.color } as CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
          <LogoMark text={hackathon.logo} src={hackathon.logoUrl} color={hackathon.color} size={26} />
          <span className="truncate font-pixel text-base">{hackathon.name}</span>
        </div>
      </header>

      <PixelCover
        seed={hackathon.slug + "-winners"}
        color={hackathon.color}
        image={hackathon.bannerUrl}
        className="border-b border-border"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-8 sm:py-20">
          <span className="rounded bg-surface/90 px-2 py-1">
            <Eyebrow className="text-accent">Winners</Eyebrow>
          </span>
          <h1 className="rounded-md bg-surface/90 px-4 py-2 text-4xl leading-tight sm:text-5xl">{hackathon.name}</h1>
          {hackathon.dates && <p className="rounded bg-surface/90 px-3 py-1 text-sm text-muted">{hackathon.dates}</p>}
        </div>
      </PixelCover>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12 sm:px-8 sm:py-16">
        <WaitingNotice title={title}>{body}</WaitingNotice>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-8 text-center text-xs text-muted">
      Judged with{" "}
      <Link href="/" className="font-pixel text-foreground">
        {brand.name}
      </Link>
    </footer>
  );
}
