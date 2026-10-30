import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { RewardImage } from "@/components/reward-image";
import { Badge, ButtonLink, Eyebrow } from "@/components/ui";
import { rewardIcon, rewardWinners } from "@/lib/data";
import type { ProjectWins } from "@/lib/results";

/** "A", "A and B", "A, B and C" */
export const listNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** What a winning project won, above the fold: its place, each prize, and what's in it. */
export function WinnerBanner({
  wins,
  slug,
  published,
  final,
}: {
  wins: ProjectWins;
  slug: string;
  /** The winners page is public. */
  published: boolean;
  /** The last phase has closed. */
  final: boolean;
}) {
  return (
    <section
      aria-label="Winner"
      className="mb-10 flex flex-col gap-5 rounded-xl border-2 border-accent bg-surface p-5 shadow-block ring-4 ring-accent-soft sm:p-6"
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="lip grid size-14 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <PixelIcon name="trophy" size={28} />
        </span>
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
          <Eyebrow className="text-accent">
            Winner{wins.rank !== null && ` · final rank #${wins.rank} of ${wins.ranked}`}
          </Eyebrow>
          <h2 className="text-2xl leading-tight">Won {listNames(wins.tiers.map((t) => t.name))}</h2>
          <p className="text-sm text-muted">
            {published ? (
              <>
                Public on the{" "}
                <Link href={`/w/${slug}`} target="_blank" className="underline underline-offset-4 hover:text-foreground">
                  winners page
                </Link>
                .
              </>
            ) : final ? (
              "The results aren't published yet."
            ) : (
              "Picked while judging is still running. Rank prizes come when the last phase closes."
            )}
          </p>
        </div>
        <ButtonLink href={`/h/${slug}/results`} variant="secondary" size="sm">
          Results <PixelIcon name="arrow-right" size={10} />
        </ButtonLink>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wins.tiers.map((t) => (
          <li key={t.id} className="flex min-w-0 gap-3 rounded-lg border-2 border-border bg-background p-3">
            <RewardImage name={t.name} imagePath={t.imagePath} size={44} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-pixel text-sm">{t.name}</span>
                <Badge tone={t.recipients === "award" ? "success" : "accent"}>
                  {t.recipients === "award" ? "award" : rewardWinners(t)}
                </Badge>
              </div>
              {t.items.length > 0 ? (
                <ul className="flex flex-col gap-1 text-xs text-muted">
                  {t.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-1.5">
                      <PixelIcon name={rewardIcon[it.kind]} size={10} className="text-accent" />
                      <span className="min-w-0 truncate">{it.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-muted">No rewards in this tier yet.</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
