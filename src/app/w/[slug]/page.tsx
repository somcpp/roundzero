import type { CSSProperties } from "react";
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { RewardImage } from "@/components/reward-image";
import { Eyebrow, LogoMark, PixelCover, cn } from "@/components/ui";
import { brand } from "@/lib/branding";
import { getPublicBannerUrl, getViewableHackathon } from "@/lib/hackathons";
import { getPublicResults, type PublicProject } from "@/lib/public-results";
import { NotAnnounced, WaitingNotice } from "./not-announced";
import { ShareButton } from "./share-button";

export async function generateMetadata({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const results = await getPublicResults(slug);
  return { title: results ? `${results.hackathon.name} — Winners` : "Winners" };
}

const teamLabel = (team: string[]) => (team.length === 0 ? "" : team.length === 1 ? "solo" : `team of ${team.length}`);
const prizes = (p: PublicProject) => p.tiers.map((t) => t.name).join(" · ");

export default async function WinnersPage({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const [results, bannerUrl] = await Promise.all([getPublicResults(slug), getPublicBannerUrl(slug)]);
  if (!results) return <NotAnnounced hackathon={await getViewableHackathon(slug)} />;
  const { hackathon, counts, finalists, awards } = results;

  const [first, second, third] = finalists;
  const podium = [
    { p: second, place: 2 },
    { p: first, place: 1 },
    { p: third, place: 3 },
  ].filter((x): x is { p: PublicProject; place: number } => !!x.p);
  const announced = finalists.length > 0 || awards.length > 0;

  // A project can show up on the podium, in an award and in the finalist list.
  // #project-<number> (linked from its admin page) goes to its place in the
  // ranking, or to its first award if it only won awards.
  const anchors = new Map<string, string>();
  for (const { p } of podium) anchors.set(p.id, "podium");
  for (const p of finalists) if (!anchors.has(p.id)) anchors.set(p.id, "finalists");
  for (const a of awards) for (const w of a.winners) if (!anchors.has(w.id)) anchors.set(w.id, a.tier.id);
  const anchor = (p: PublicProject, at: string) => (anchors.get(p.id) === at ? `project-${p.number}` : undefined);

  return (
    <div className="brand flex min-h-screen flex-col" style={{ "--brand": hackathon.color } as CSSProperties}>
      {!hackathon.published && (
        <div className="bg-warning-soft px-4 py-2 sm:px-8 text-center text-sm text-warning-soft-foreground">
          Preview — only you can see this page until you publish results.
        </div>
      )}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
          <LogoMark text={hackathon.logo} src={hackathon.logoUrl} color={hackathon.color} size={26} />
          <span className="truncate font-pixel text-base">{hackathon.name}</span>
          <ShareButton title={`${hackathon.name} — Winners`} />
        </div>
      </header>

      <PixelCover seed={hackathon.slug + "-winners"} color={hackathon.color} image={bannerUrl} className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-8 sm:py-20">
          <span className="rounded bg-surface/90 px-2 py-1">
            <Eyebrow className="text-accent">Winners</Eyebrow>
          </span>
          <h1 className="rounded-md bg-surface/90 px-4 py-2 text-4xl leading-tight sm:text-5xl">{hackathon.name}</h1>
          <p className="rounded bg-surface/90 px-3 py-1 text-sm text-muted">
            {counts.projects} {counts.projects === 1 ? "project" : "projects"} · {counts.judges}{" "}
            {counts.judges === 1 ? "judge" : "judges"} · {hackathon.dates}
          </p>
        </div>
      </PixelCover>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-12 sm:gap-20 sm:px-8 sm:py-16">
        {!announced && (
          <WaitingNotice title="Winners are on their way">
            The judges are still deciding. Check back once results are announced.
          </WaitingNotice>
        )}

        {podium.length > 0 && (
          <section className="grid items-end gap-5 md:grid-cols-[1fr_1.25fr_1fr]">
            {podium.map(({ p, place }) => {
              const top = place === 1;
              return (
                <div
                  key={p.id}
                  id={anchor(p, "podium")}
                  className={cn(
                    "flex scroll-mt-8 flex-col gap-4 rounded-xl border bg-surface p-6 target:border-accent target:ring-4 target:ring-accent/40",
                    top ? "order-first border-accent p-7 ring-4 ring-accent-soft md:order-none" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid place-items-center rounded-md font-pixel",
                        top ? "size-12 bg-accent text-2xl text-accent-foreground" : "size-10 bg-surface-secondary text-lg",
                      )}
                    >
                      {place}
                    </span>
                    {top && <PixelIcon name="trophy" size={20} className="text-accent" />}
                  </div>
                  {top && p.video && (
                    <a
                      href={p.video}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Watch the ${p.name} demo`}
                      className="dither relative grid aspect-video place-items-center rounded-lg border border-border"
                    >
                      <span className="grid size-12 place-items-center rounded-full bg-foreground text-background">
                        <PixelIcon name="play" size={14} />
                      </span>
                    </a>
                  )}
                  <div className="flex flex-col gap-1">
                    <h2 className={cn("leading-tight", top ? "text-2xl" : "text-lg")}>{p.name}</h2>
                    <p className="text-sm text-muted">
                      {p.pitch}
                      {top && teamLabel(p.team) && <> · {teamLabel(p.team)}</>}
                    </p>
                  </div>
                  {p.tiers.length > 0 && <p className="text-xs font-semibold text-accent">{prizes(p)}</p>}
                  {(p.repo || p.demo) && (
                    <div className="flex gap-4 text-sm">
                      {p.repo && (
                        <a className="flex items-center gap-1.5 text-accent hover:underline" href={p.repo} target="_blank" rel="noreferrer">
                          <PixelIcon name="branch" size={10} /> Repo
                        </a>
                      )}
                      {p.demo && (
                        <a className="flex items-center gap-1.5 text-accent hover:underline" href={p.demo} target="_blank" rel="noreferrer">
                          Demo <PixelIcon name="external" size={10} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {awards.length > 0 && (
          <section className="flex flex-col gap-6">
            <h2 className="text-2xl leading-none">Category winners</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {awards.map(({ tier, winners }) => (
                <div key={tier.id} className="flex items-center gap-4 rounded-xl border border-border p-6">
                  <RewardImage name={tier.name} imagePath={tier.imagePath} size={44} className="rounded-lg" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Eyebrow>{tier.name}</Eyebrow>
                    {winners.map((w) => (
                      <span
                        key={w.id}
                        id={anchor(w, tier.id)}
                        className="-mx-1.5 scroll-mt-8 truncate rounded-md px-1.5 font-pixel text-lg target:bg-accent-soft target:text-accent-soft-foreground"
                      >
                        {w.name}
                      </span>
                    ))}
                    {tier.description && <span className="text-xs text-muted">{tier.description}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {finalists.length > 0 && (
          <section id="finalists" className="flex flex-col gap-6">
            <h2 className="text-2xl leading-none">
              All {finalists.length} {finalists.length === 1 ? "finalist" : "finalists"}
            </h2>
            <ol className="divide-y divide-border rounded-xl border border-border">
              {finalists.map((p) => (
                <li
                  key={p.id}
                  id={anchor(p, "finalists")}
                  className="grid scroll-mt-8 grid-cols-[40px_1fr_auto] items-center gap-4 px-6 py-4 target:bg-accent-soft"
                >
                  <span className="font-pixel text-muted">{String(p.rank).padStart(2, "0")}</span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{p.name}</span>
                    <span className="truncate text-xs text-muted">{p.pitch}</span>
                  </div>
                  <span className="flex flex-col items-end gap-0.5 text-right text-xs text-muted">
                    {p.tiers.length > 0 && <span className="text-accent">{prizes(p)}</span>}
                    {teamLabel(p.team)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        Judged with{" "}
        <Link href="/" className="font-pixel text-foreground">
          {brand.name}
        </Link>
      </footer>
    </div>
  );
}
