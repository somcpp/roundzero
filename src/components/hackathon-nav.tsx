"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentProps } from "react";
import { STAGE_HOME, type Hackathon, type IconName, type Stage } from "@/lib/data";
import type { FailedInboxSummary } from "@/lib/failed-inbox";
import { BrandMark } from "./brand-mark";
import { FailedInboxButton } from "./failed-inbox";
import { IntentLink } from "./intent-link";
import { PixelIcon } from "./pixel-icon";
import { LogoMark, cn } from "./ui";

const STAGES: { id: Stage; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "list" },
  { id: "judging", label: "Judging", icon: "eye" },
  { id: "results", label: "Results", icon: "trophy" },
];

const SUBNAV: Record<Stage, { label: string; href: string; icon: IconName; external?: boolean }[]> = {
  setup: [
    { label: "Schema", icon: "table", href: "setup/schema" },
    { label: "Criteria", icon: "check-list", href: "setup/criteria" },
    { label: "Judges", icon: "users", href: "setup/judges" },
    { label: "Phases", icon: "calendar", href: "setup/phases" },
    { label: "Distribution", icon: "grid", href: "setup/distribution" },
    { label: "Judge portal", icon: "eye", href: "setup/portal" },
    { label: "Branding", icon: "paint-brush", href: "setup/branding" },
    { label: "General", icon: "gear", href: "setup/general" },
  ],
  judging: [
    { label: "Projects", icon: "table", href: "judging/projects" },
    { label: "Progress", icon: "chart-line", href: "judging/progress" },
    { label: "Rewards", icon: "gift", href: "judging/rewards" },
    { label: "Chat", icon: "chat", href: "judging/chat" },
  ],
  results: [
    { label: "Winners", icon: "crown", href: "results" },
    { label: "Emails", icon: "mail", href: "results/emails" },
    { label: "Public page", icon: "globe", href: "/w/", external: true },
  ],
};

function stageFromPath(rest: string): Stage {
  if (rest.startsWith("setup")) return "setup";
  if (rest.startsWith("results")) return "results";
  return "judging";
}

export function HackathonNav({
  hackathon,
  failedInbox,
}: {
  hackathon: Hackathon;
  /** Agent gate failures waiting on a call; null before judging starts. */
  failedInbox?: FailedInboxSummary | null;
}) {
  const pathname = usePathname();
  const base = `/h/${hackathon.slug}`;
  const viewing = stageFromPath(pathname.slice(base.length + 1));
  // The longest tab href the path sits under, so /judging/projects/7 lights up Projects.
  const activeHref = SUBNAV[viewing]
    .filter((item) => !item.external)
    .map((item) => `${base}/${item.href}`)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  // Keep the active tab in view when the row scrolls sideways.
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabs.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (row && active) row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
  }, [activeHref]);

  return (
    <header className="sticky top-0 z-20 bg-white">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-8">
        <IntentLink
          href="/"
          className="flex shrink-0 items-center gap-2 text-muted transition hover:text-foreground"
          aria-label="All hackathons"
        >
          <BrandMark className="size-9" badgeClassName="border-2 border-border bg-surface text-xs text-foreground" />
        </IntentLink>
        <span className="hidden text-border-secondary sm:inline">/</span>
        <IntentLink href={`${base}/${STAGE_HOME[hackathon.stage]}`} className="flex min-w-0 items-center gap-2.5">
          <LogoMark text={hackathon.logo} src={hackathon.logoUrl} color={hackathon.color} size={32} />
          <span className="truncate font-pixel text-lg">{hackathon.name}</span>
        </IntentLink>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <JudgingStatus hackathon={hackathon} href={`${base}/judging/progress`} />
          {hackathon.judgingStartedAt && failedInbox && <FailedInboxButton slug={hackathon.slug} summary={failedInbox} />}
          {/* Three areas of the same hackathon, not steps: a plain segmented switch. Icons only on phones. */}
          <nav className="flex items-center gap-0.5 rounded-xl border-2 border-border bg-surface p-1" aria-label="Areas">
            {STAGES.map((s) => {
              const active = s.id === viewing;
              return (
                <IntentLink
                  key={s.id}
                  href={`${base}/${STAGE_HOME[s.id]}`}
                  aria-current={active ? "page" : undefined}
                  aria-label={s.label}
                  title={s.label}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg px-3 text-[15px] font-bold transition sm:px-4",
                    active ? "lip bg-foreground text-background" : "text-muted hover:bg-surface-secondary hover:text-foreground",
                  )}
                >
                  <TabIcon name={s.icon} />
                  <span className="hidden sm:inline">{s.label}</span>
                </IntentLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* The header's bottom rule, drawn as an inset line so the active tab's underline paints over it. */}
      <div className="shadow-[inset_0_-2px_0_0_var(--border)]">
        {/* Scrolls sideways when the tabs don't fit, so every tab stays reachable on a phone. */}
        <div
          ref={tabs}
          className="relative mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {SUBNAV[viewing].map((item) => {
            const href = item.external ? `/w/${hackathon.slug}` : `${base}/${item.href}`;
            const active = href === activeHref;
            return (
              <NavLink
                key={item.label}
                external={item.external}
                href={href}
                target={item.external ? "_blank" : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-4 px-3 py-3 text-base font-semibold whitespace-nowrap transition",
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                <TabIcon name={item.icon} className={active ? "text-accent" : undefined} />
                {item.label}
                {item.external && <PixelIcon name="external" size={10} />}
              </NavLink>
            );
          })}
        </div>
      </div>
    </header>
  );
}

/** "Start judging" until it starts, then the phase that's running. */
function JudgingStatus({ hackathon, href }: { hackathon: Hackathon; href: string }) {
  if (!hackathon.judgingStartedAt) {
    return (
      <IntentLink
        href={href}
        className="lip hidden h-10 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover sm:flex"
      >
        Start judging
        <PixelIcon name="arrow-right" size={12} />
      </IntentLink>
    );
  }
  const phase = hackathon.currentPhase;
  if (!phase) return null;
  return (
    <IntentLink
      href={href}
      title="Judging progress"
      className="hidden h-10 items-center gap-2 rounded-lg border-2 border-border px-3 text-sm font-semibold transition hover:border-accent sm:flex"
    >
      <span className="size-2 animate-pulse bg-accent" />
      <span className="font-pixel text-xs text-muted">
        {phase.index + 1}/{phase.count}
      </span>
      <span className="max-w-40 truncate">{phase.name}</span>
    </IntentLink>
  );
}

/** The public page opens in a new tab, so only in-app tabs prefetch on hover. */
function NavLink({ external, ...rest }: ComponentProps<typeof Link> & { external?: boolean }) {
  return external ? <Link {...rest} /> : <IntentLink {...rest} />;
}

/** A tab's icon, which blinks while its page is on the way. Must sit inside a Link. */
function TabIcon({ name, className }: { name: IconName; className?: string }) {
  const { pending } = useLinkStatus();
  return <PixelIcon name={name} size={14} className={cn(className, pending && "animate-pulse")} />;
}
