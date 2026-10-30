import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { LogoMark, Segments, cn } from "@/components/ui";
import { brand } from "@/lib/branding";
import { initials } from "@/lib/format-hackathon";
import { hackathonLogoUrl } from "@/lib/hackathon-logos";
import type { JudgePortal } from "@/lib/judge-portal";
import { JudgePhoto } from "../../h/[slug]/setup/judges/judge-photo";

export type PortalProgress = {
  /** e.g. "Today" or "Project 3". */
  label: string;
  done: number;
  total: number;
  /** Shown on the right, e.g. "3 / 10". */
  count: string;
  prevHref?: string | null;
  nextHref?: string | null;
};

/** The judge's page chrome: the hackathon, their progress, and who they are. */
export function PortalFrame({
  portal,
  home,
  progress,
  children,
}: {
  portal: Pick<JudgePortal, "hackathon" | "judge">;
  /** The judge's start screen, /j/<token>. */
  home: string;
  progress?: PortalProgress;
  children: ReactNode;
}) {
  const { hackathon, judge } = portal;
  return (
    <div className="brand flex min-h-screen flex-col" style={{ "--brand": hackathon.color } as CSSProperties}>
      <header className="sticky top-0 z-20 border-b-2 border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-8">
          <Link href={home} className="flex min-w-0 items-center gap-2.5" title="Your judging overview">
            <LogoMark
              text={hackathon.logo || initials(hackathon.name) || "?"}
              src={hackathonLogoUrl(hackathon.logoPath)}
              color={hackathon.color}
              size={28}
            />
            <span className="truncate font-pixel text-base">{hackathon.name}</span>
          </Link>

          {progress && (
            <div className="mx-auto hidden md:block">
              <Progress progress={progress} />
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2.5 text-sm md:ml-0">
            <JudgePhoto name={judge.name} imagePath={judge.imagePath} size={28} />
            <span className="hidden sm:inline">{judge.name}</span>
          </div>
        </div>
        {progress && (
          <div className="border-t border-border px-4 py-2 md:hidden">
            <Progress progress={progress} />
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-10 sm:px-8">{children}</main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Private judging link for {judge.name} · judged with <span className="font-pixel text-foreground">{brand.name}</span>
      </footer>
    </div>
  );
}

function Progress({ progress: p }: { progress: PortalProgress }) {
  return (
    <div className="flex items-center gap-3">
      <Step href={p.prevHref} label="Previous project" icon="arrow-left" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:w-56 md:flex-none">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted">{p.label}</span>
          <span className="font-pixel text-sm">{p.count}</span>
        </div>
        <Segments
          value={p.done}
          max={Math.max(p.total, 1)}
          count={Math.min(Math.max(p.total, 1), 30)}
          className="h-1.5"
          tone={p.total > 0 && p.done === p.total ? "success" : "accent"}
        />
      </div>
      <Step href={p.nextHref} label="Next project" icon="arrow-right" />
    </div>
  );
}

function Step({ href, label, icon }: { href?: string | null; label: string; icon: "arrow-left" | "arrow-right" }) {
  const cls = "grid size-8 shrink-0 place-items-center rounded-md border-2 border-border text-muted transition";
  if (href === undefined) return null;
  if (href === null) {
    return (
      <span aria-hidden className={cn(cls, "opacity-30")}>
        <PixelIcon name={icon} size={10} />
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} title={label} className={cn(cls, "hover:border-accent hover:text-foreground")}>
      <PixelIcon name={icon} size={10} />
    </Link>
  );
}
