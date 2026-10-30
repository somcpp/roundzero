"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Button } from "@heroui/react";
import { STAGE_HOME, type Hackathon } from "@/lib/data";
import { DEMO_READ_ONLY } from "@/lib/demo";
import { IntentLink } from "./intent-link";
import { PixelIcon } from "./pixel-icon";
import { Badge, ButtonLink, LogoMark, PixelCover, Segments, cn, type Tone } from "./ui";

const STAGE_TONE: Record<Hackathon["stage"], Tone> = {
  setup: "neutral",
  judging: "accent",
  results: "success",
};

/** The home page. The demo account (`demo`) sees the demo hackathons and can't start one; it's pointed at self-hosting instead. */
export function HackathonCollection({ hackathons, demo = false }: { hackathons: Hackathon[]; demo?: boolean }) {
  const [view, setView] = useState<"cards" | "list">("cards");

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-none">{demo ? "Demo hackathons" : "Your hackathons"}</h1>
          <p className="text-muted">
            {hackathons.length} {hackathons.length === 1 ? "event" : "events"} ·{" "}
            {hackathons.reduce((n, h) => n + h.projects, 0)} projects judged
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex rounded-lg border border-border p-0.5" role="tablist" aria-label="View">
            {(["cards", "list"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm capitalize transition",
                  view === v ? "bg-foreground text-background" : "text-muted hover:text-foreground",
                )}
              >
                <PixelIcon name={v === "cards" ? "grid" : "list"} size={12} />
                {v}
              </button>
            ))}
          </div>
          {demo ? (
            <span title={DEMO_READ_ONLY}>
              <Button isDisabled>
                <PixelIcon name="plus" size={12} />
                New hackathon
              </Button>
            </span>
          ) : (
            <ButtonLink href="/new">
              <PixelIcon name="plus" size={12} />
              New hackathon
            </ButtonLink>
          )}
        </div>
      </div>

      {demo && <SelfHost />}

      {view === "cards" ? <Shelf hackathons={hackathons} demo={demo} /> : <Rows hackathons={hackathons} demo={demo} />}
    </>
  );
}

/** For the demo account: it can only look, so point it at getting an organizer account. */
function SelfHost() {
  return (
    <div className="mb-10 flex flex-wrap items-center gap-5 rounded-2xl border-2 border-dashed border-border-secondary bg-surface px-6 py-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <PixelIcon name="code" size={20} />
      </span>
      <div className="flex min-w-60 flex-1 flex-col gap-1">
        <h2 className="text-lg leading-tight">Run your own hackathons</h2>
        <p className="text-sm text-muted">
          The demo can&apos;t create hackathons. Ask the RoundZero team for an organizer account, then create as
          many as you like.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* New tabs, so the demo stays open behind them. */}
        <ButtonLink href="/docs" target="_blank" rel="noreferrer">
          Read the docs <PixelIcon name="external" size={12} />
        </ButtonLink>
      </div>
    </div>
  );
}

function Shelf({ hackathons, demo }: { hackathons: Hackathon[]; demo: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {hackathons.map((h) => (
        <IntentLink
          key={h.slug}
          href={`/h/${h.slug}/${STAGE_HOME[h.stage]}`}
          className="brand group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]"
          style={{ "--brand": h.color } as CSSProperties}
        >
          <PixelCover seed={h.slug} color={h.color} image={h.bannerUrl} className="h-52">
            <div className="flex h-52 flex-col justify-between p-6">
              <LogoMark text={h.logo} src={h.logoUrl} color={h.color} size={44} />
              <span className="self-start rounded bg-surface/90 px-2 py-1 text-xs font-medium text-muted">
                {h.tagline}
              </span>
            </div>
          </PixelCover>
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl leading-tight">{h.name}</h2>
              <p className="text-sm text-muted">
                {h.dates} · {h.projects || "no"} projects · {h.judges} judges
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <Badge tone={STAGE_TONE[h.stage]} dot={h.stage === "judging"}>
                  {h.published && <PixelIcon name="check" size={10} />}
                  {h.status}
                </Badge>
                {h.stage === "judging" && <span className="font-pixel text-xs">{h.progress}% reviewed</span>}
              </div>
              {h.stage === "judging" && <Segments value={h.progress} />}
              {h.published && (
                <span className="flex items-center gap-1.5 text-sm text-accent">
                  Winners page <PixelIcon name="external" size={10} />
                </span>
              )}
              {h.setupProgress && <span className="text-sm text-muted">{h.setupProgress}</span>}
            </div>
          </div>
        </IntentLink>
      ))}

      {demo && hackathons.length === 0 && (
        <p className="col-span-full rounded-2xl border border-dashed border-border-secondary p-10 text-center text-muted">
          No demo hackathons yet. Check back soon.
        </p>
      )}
      {!demo && (
        <Link
          href="/new"
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-secondary p-8 text-center text-muted transition hover:border-foreground hover:text-foreground"
        >
          <span className="grid size-12 place-items-center rounded-lg border border-current">
            <PixelIcon name="plus" size={16} />
          </span>
          <span className="font-pixel text-base">Start a hackathon</span>
        </Link>
      )}
    </div>
  );
}

function Rows({ hackathons, demo }: { hackathons: Hackathon[]; demo: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary/60 text-left">
          <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:font-pixel [&>th]:text-[11px] [&>th]:font-normal [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
            <th>Name</th>
            <th>Dates</th>
            <th>Stage</th>
            <th className="w-56">Progress</th>
            <th className="text-right">Projects</th>
            <th className="text-right">Judges</th>
          </tr>
        </thead>
        <tbody>
          {hackathons.length === 0 && (
            <tr className="border-t border-border">
              <td colSpan={6} className="px-5 py-10 text-center text-muted">
                {demo ? (
                  "No demo hackathons yet."
                ) : (
                  <>
                    No hackathons yet. <Link href="/new" className="text-accent">Start one</Link>
                  </>
                )}
              </td>
            </tr>
          )}
          {hackathons.map((h) => (
            <tr
              key={h.slug}
              className="brand border-t border-border transition hover:bg-surface-secondary/40 [&>td]:px-5 [&>td]:py-4"
              style={{ "--brand": h.color } as CSSProperties}
            >
              <td>
                <IntentLink href={`/h/${h.slug}/${STAGE_HOME[h.stage]}`} className="flex items-center gap-3">
                  <LogoMark text={h.logo} src={h.logoUrl} color={h.color} size={28} />
                  <span className="font-pixel text-[15px]">{h.name}</span>
                </IntentLink>
              </td>
              <td className="text-muted">{h.dates}</td>
              <td>
                <Badge tone={STAGE_TONE[h.stage]}>{h.status}</Badge>
              </td>
              <td>
                <div className="flex items-center gap-3">
                  <Segments value={h.progress} count={16} className="flex-1" tone={h.progress === 100 ? "success" : "accent"} />
                  <span className="w-9 text-right font-pixel text-xs">{h.progress}%</span>
                </div>
              </td>
              <td className="text-right font-pixel">{h.projects}</td>
              <td className="text-right font-pixel">{h.judges}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
