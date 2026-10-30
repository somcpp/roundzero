"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { RewardImage } from "@/components/reward-image";
import { ToolbarSelect } from "@/components/toolbar";
import { Badge, ButtonLink, Eyebrow, PageHeader, Panel, PixelCover, SectionTitle, cn } from "@/components/ui";
import { describeGateFails } from "@/lib/gate-status";
import { formatNumber } from "@/lib/project-fields";
import type { AnnounceStatus } from "@/lib/email/announce";
import type { AwardResult, RankedProject, Results } from "@/lib/results";
import { publishResults, setAwardWinners, setFinalRanking } from "@/lib/results-actions";
import { ResultsEmails } from "./results-emails";

const SHOWN = 10;

/** Gold, silver and bronze: the number tiles and podium blocks for the top three. */
const MEDALS = [
  { tile: "bg-amber-400 text-amber-950", block: "h-32 sm:h-36" },
  { tile: "bg-zinc-300 text-zinc-800", block: "h-24 sm:h-28" },
  { tile: "bg-orange-300 text-orange-950", block: "h-16 sm:h-20" },
];

export function Winners({
  slug,
  results,
  published,
  canPublish,
  emailStatus,
}: {
  slug: string;
  results: Results;
  published: boolean;
  canPublish: boolean;
  /** Who the results emails go to (./results-emails), once the ranking is final. */
  emailStatus: AnnounceStatus | null;
}) {
  const final = results.state === "final";
  const hint =
    results.state === "final"
      ? `Final ranking from ${results.sourcePhase}.`
      : results.state === "projected"
        ? `Projected from ${results.sourcePhase}. It locks in when the last phase closes.`
        : "Judging hasn't started, so there's no ranking yet.";
  const publishNote = published
    ? "The winners page is public."
    : canPublish
      ? "Publishing makes the winners page public. Emails go out separately, below."
      : "Publish once the last phase has closed.";
  const prizes = results.winners.reduce((n, w) => n + w.tiers.length, 0);

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Results"
        title="Winners"
        hint={
          <>
            {hint} <span className="text-xs">{publishNote}</span>
          </>
        }
        actions={
          <>
            {published ? (
              <Badge tone="success" dot>
                Published
              </Badge>
            ) : final ? (
              <Badge tone="warning">Draft, not published</Badge>
            ) : (
              <Badge tone="accent" dot>
                {results.state === "projected" ? "Judging in progress" : "Not started"}
              </Badge>
            )}
            <ButtonLink href={`/h/${slug}/results/emails`} variant="secondary">
              <PixelIcon name="mail" size={12} /> Winner emails
            </ButtonLink>
            {published && (
              <ButtonLink href={`/w/${slug}`} target="_blank" variant="secondary">
                <PixelIcon name="globe" size={12} /> Public page
              </ButtonLink>
            )}
            <PublishButton slug={slug} published={published} canPublish={canPublish} />
          </>
        }
      />

      <div className="flex flex-col gap-14">
        {emailStatus && <ResultsEmails slug={slug} status={emailStatus} />}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            {results.ranking.length === 0 ? (
              <Panel className="flex flex-col items-start gap-3 p-8 text-sm text-muted">
                Winners show up here once judging is under way.
                <ButtonLink href={`/h/${slug}/judging/progress`} variant="secondary">
                  Go to Progress <PixelIcon name="arrow-right" size={12} />
                </ButtonLink>
              </Panel>
            ) : (
              <Ranking ranking={results.ranking} draggable={final} slug={slug} />
            )}
          </section>

          <section className="min-w-0">
            <SectionTitle
              hint="picked by you"
              action={
                <Link href={`/h/${slug}/judging/rewards`} className="text-xs text-muted hover:text-foreground">
                  Edit awards
                </Link>
              }
            >
              Awards
            </SectionTitle>
            {results.awards.length === 0 ? (
              <Link
                href={`/h/${slug}/judging/rewards`}
                className="block rounded-xl border-2 border-dashed border-border-secondary p-4 text-sm text-muted hover:text-foreground"
              >
                No awards yet. Add one as a reward tier with “Award” as who wins →
              </Link>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {results.awards.map((a) => (
                  <AwardCard key={a.tier.id} award={a} slug={slug} />
                ))}
              </div>
            )}
          </section>
        </div>

        <section>
          <SectionTitle
            hint={
              results.winners.length
                ? `${results.winners.length} ${results.winners.length === 1 ? "winner" : "winners"} · ${prizes} ${prizes === 1 ? "prize" : "prizes"}`
                : undefined
            }
            action={
              <Link href={`/h/${slug}/judging/rewards`} className="text-xs text-muted hover:text-foreground">
                Edit rewards
              </Link>
            }
          >
            Who gets what
          </SectionTitle>
          {results.winners.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-sm text-muted">
              Nobody wins anything yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.winners.map((w) => (
                <li key={w.project.id}>
                  <Link
                    href={`/h/${slug}/judging/projects/${w.project.number}`}
                    className="flex h-full items-start gap-3 rounded-xl border-2 border-border bg-surface p-4 shadow-block-sm transition hover:-translate-y-0.5 hover:border-border-strong"
                  >
                    <PlaceTile rank={w.rank} />
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="truncate font-medium">{w.project.name}</span>
                      <span className="flex flex-wrap gap-1">
                        {w.tiers.map((t) => (
                          <Badge key={t.id} tone={t.recipients === "award" ? "success" : "accent"}>
                            <PixelIcon name={t.recipients === "award" ? "crown" : "trophy"} size={10} />
                            {t.name}
                          </Badge>
                        ))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** A finishing place as a pixel tile: gold, silver and bronze for the podium, an award ribbon for none. */
function PlaceTile({ rank, size = "md" }: { rank: number | null; size?: "sm" | "md" }) {
  const medal = rank !== null && rank <= 3 ? MEDALS[rank - 1] : null;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-pixel",
        size === "md" ? "size-9 text-lg" : "size-7 text-sm",
        medal ? cn("lip", medal.tile) : "bg-surface-secondary text-muted",
      )}
    >
      {rank ?? <PixelIcon name="crown" size={size === "md" ? 14 : 12} />}
    </span>
  );
}

/** The top three on a pixel-art stage: second, first, third, like a real podium. */
function Podium({
  top,
  tiersAt,
  slug,
}: {
  top: RankedProject[];
  tiersAt: (i: number) => RankedProject["tiers"];
  slug: string;
}) {
  const order = [1, 0, 2].filter((i) => top[i]);
  // A neutral backdrop, so gold, silver and bronze carry the color rather than the hackathon's tint.
  return (
    <PixelCover seed={slug} neutral className="mb-6 rounded-xl border-2 border-border shadow-block">
      <div className="flex items-end justify-center gap-3 px-4 pt-8 sm:gap-5">
        {order.map((i) => {
          const r = top[i];
          const prize = tiersAt(i)[0];
          return (
            <div key={r.id} className="flex w-32 min-w-0 flex-col items-center gap-2 sm:w-48">
              {i === 0 && (
                <PixelIcon name="crown" size={24} className="animate-bounce text-amber-500 motion-reduce:animate-none" />
              )}
              <Link
                href={`/h/${slug}/judging/projects/${r.number}`}
                className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border-2 border-border bg-surface px-3 py-2 text-center shadow-block-sm transition hover:-translate-y-0.5"
              >
                <span className="w-full truncate font-medium">{r.name}</span>
                <span className="font-pixel text-xs text-muted">
                  {r.phaseScore !== null ? r.phaseScore.toFixed(1) : "–"}
                </span>
                {prize && (
                  <span className="flex max-w-full items-center gap-1 truncate text-xs text-accent-soft-foreground">
                    <PixelIcon name="trophy" size={10} className="shrink-0" />
                    <span className="truncate">{prize.name}</span>
                  </span>
                )}
              </Link>
              <div className={cn("lip flex w-full justify-center rounded-t-lg pt-2", MEDALS[i].tile, MEDALS[i].block)}>
                <span className="font-pixel text-3xl leading-none">{i + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </PixelCover>
  );
}

function Ranking({
  ranking,
  draggable,
  slug,
}: {
  ranking: RankedProject[];
  draggable: boolean;
  slug: string;
}) {
  const [rows, setRows] = useState(ranking);
  const [expanded, setExpanded] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  const dirty = rows.map((r) => r.id).join() !== ranking.map((r) => r.id).join();
  const shown = expanded ? rows : rows.slice(0, SHOWN);

  const move = (from: number, to: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });

  // Prizes follow the position, so show what each slot would win after a drag.
  const tiersAt = (i: number) => ranking[i]?.tiers ?? [];

  return (
    <>
      <Podium top={rows.slice(0, 3)} tiersAt={tiersAt} slug={slug} />
      <SectionTitle hint={draggable ? "drag to adjust" : undefined}>Ranking</SectionTitle>
      <SaveError error={error} />
      {dirty && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-accent-soft px-4 py-2 text-sm text-accent-soft-foreground">
          <span className="flex-1">
            {readOnly
              ? "Order changed. This is a demo, so it isn't saved."
              : "Order changed. Saving logs the new rank on each project that moved."}
          </span>
          <Button size="sm" variant="tertiary" onPress={() => setRows(ranking)} isDisabled={pending}>
            Undo
          </Button>
          <Button
            size="sm"
            isDisabled={readOnly || pending}
            onPress={() =>
              start(async () => {
                setError(undefined);
                const result = await setFinalRanking(slug, rows.map((r) => r.id));
                if ("error" in result) setError(result.error);
              })
            }
          >
            {pending ? "Saving…" : "Save order"}
          </Button>
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {shown.map((r, i) => {
          const podium = i < 3;
          const tiers = tiersAt(i);
          return (
            <li
              key={r.id}
              draggable={draggable}
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => draggable && e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== i) move(dragIdx, i);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={cn(
                "grid grid-cols-[40px_1fr_auto] items-center gap-4 rounded-lg border-2 px-4 transition sm:grid-cols-[40px_1fr_auto_auto]",
                draggable && "cursor-grab active:cursor-grabbing",
                podium ? "border-border bg-surface py-4" : "border-transparent py-2.5 hover:border-border",
                i === 0 && "border-accent ring-4 ring-accent-soft",
                dragIdx === i && "opacity-40",
              )}
            >
              <PlaceTile rank={i + 1} size={podium ? "md" : "sm"} />
              <Link href={`/h/${slug}/judging/projects/${r.number}`} className="flex min-w-0 flex-col" draggable={false}>
                <span className={cn("truncate font-medium hover:underline", podium ? "text-base" : "text-sm")}>{r.name}</span>
                {podium && r.pitch && <span className="truncate text-xs text-muted">{r.pitch}</span>}
              </Link>
              <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                {r.gate && (
                  <Badge tone={r.gate.ruledOut ? "danger" : "warning"} title={describeGateFails(r.gate.fails)}>
                    <PixelIcon name={r.gate.ruledOut ? "lock" : "flag"} size={10} />
                    {r.gate.ruledOut ? "ruled out" : "gate flagged"}
                  </Badge>
                )}
                {tiers.slice(0, 2).map((t) => (
                  <Badge key={t.id} tone={i === 0 ? "accent" : "neutral"}>
                    {i === 0 && <PixelIcon name="trophy" size={10} />}
                    {t.name}
                  </Badge>
                ))}
                {tiers.length > 2 && <Badge>+{tiers.length - 2}</Badge>}
                {tiers.length === 0 && r.blockedBy && (
                  <Badge title={`One prize per team: ${r.blockedBy.name} already takes this team's prize, so the places below move up.`}>
                    <PixelIcon name="users" size={10} />
                    Team won with {formatNumber(r.blockedBy.number)}
                  </Badge>
                )}
              </span>
              <span className={cn("w-10 text-right font-pixel", podium ? "text-lg" : "text-sm text-muted")}>
                {r.phaseScore !== null ? r.phaseScore.toFixed(1) : "–"}
              </span>
            </li>
          );
        })}
      </ol>
      {rows.length > SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex items-center gap-2 px-4 text-sm text-muted hover:text-foreground"
        >
          <PixelIcon name={expanded ? "arrow-up" : "arrow-down"} size={10} />
          {expanded ? `Show top ${SHOWN}` : `${rows.length - SHOWN} more`}
        </button>
      )}
    </>
  );
}

function AwardCard({ award: a, slug }: { award: AwardResult; slug: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  const slots = a.tier.winnerCount ?? 1;
  const winnerIds = a.winners.map((w) => w.id);
  const save = (ids: string[]) =>
    start(async () => {
      setError(undefined);
      const result = await setAwardWinners(slug, a.tier.id, ids);
      if ("error" in result) setError(result.error);
    });
  const open = a.candidates.filter((c) => c.eligible && !winnerIds.includes(c.id));
  const top = open.slice(0, 3);

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <RewardImage name={a.tier.name} imagePath={a.tier.imagePath} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-pixel text-sm">{a.tier.name}</span>
          {a.tier.description && <span className="text-xs text-muted">{a.tier.description}</span>}
        </div>
        <Badge>
          {a.winners.length}/{slots}
        </Badge>
      </div>

      <SaveError error={error} />

      {a.winners.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {a.winners.map((w) => (
            <li key={w.id} className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
              <PixelIcon name="trophy" size={12} />
              <Link href={`/h/${slug}/judging/projects/${w.number}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {w.name}
              </Link>
              <ConfirmButton
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Remove ${w.name}`}
                className="size-7 min-w-0 text-current"
                title={`Remove ${w.name} from ${a.tier.name}?`}
                description="It's logged in the project's audit trail, and they won't get this award's rewards."
                confirmLabel="Remove winner"
                onConfirm={async () => {
                  const result = await setAwardWinners(slug, a.tier.id, winnerIds.filter((id) => id !== w.id));
                  if ("error" in result) return result.error;
                }}
              >
                <PixelIcon name="x" size={10} />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      {a.winners.length < slots && !readOnly && (
        <div className="flex flex-col gap-2">
          {top.length > 0 && (
            <div className="flex flex-col gap-1">
              <Eyebrow>Suggested</Eyebrow>
              {top.map((c) => {
                const shown = a.criterion ? c.criterionScore : c.score;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={pending}
                    onClick={() => save([...winnerIds, c.id])}
                    className="flex items-center gap-2 rounded-md border-2 border-border px-3 py-1.5 text-left text-sm transition hover:border-accent disabled:opacity-50"
                  >
                    <span className="font-pixel text-xs text-muted">{formatNumber(c.number)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="font-pixel text-xs" title={a.criterion ? `Average on ${a.criterion.title}` : "Average judge score"}>
                      {shown !== null ? shown.toFixed(1) : "–"}
                    </span>
                    <PixelIcon name="plus" size={10} className="text-muted" />
                  </button>
                );
              })}
            </div>
          )}
          <ToolbarSelect
            label={`Pick a winner for ${a.tier.name}`}
            value=""
            active={false}
            onChange={(id) => id && save([...winnerIds, id])}
            options={[
              { value: "", label: pending ? "Saving…" : "Pick any project…" },
              ...open.map((c) => ({ value: c.id, label: `${formatNumber(c.number)} ${c.name}` })),
            ]}
          />
        </div>
      )}

      <p className="text-xs text-muted">{pickHint(a, a.candidates.some((c) => !c.eligible))}</p>
    </Panel>
  );
}

function pickHint({ tier: t, criterion }: AwardResult, someBlocked: boolean) {
  const how = criterion
    ? `Suggested by judges' average on ${criterion.title}.`
    : t.pick === "criterion"
      ? "Its criterion was removed, so suggestions use the overall score."
      : "Picked by hand.";
  return `${how}${someBlocked ? (t.exclusive ? " Projects with a rank prize or a failed gate are left out." : " Projects that failed a gate are left out.") : ""} ${
    t.items.length ? `Wins ${t.items.map((i) => i.label).join(", ")}.` : ""
  }`;
}

function PublishButton({ slug, published, canPublish }: { slug: string; published: boolean; canPublish: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  if (published) {
    return (
      <ConfirmButton
        variant="secondary"
        size="md"
        title="Unpublish results?"
        description="The public winners page goes back to private."
        confirmLabel="Unpublish"
        onConfirm={async () => {
          const result = await publishResults(slug, false);
          if ("error" in result) return result.error;
        }}
      >
        Unpublish
      </ConfirmButton>
    );
  }
  return (
    <>
      <SaveError error={error} />
      <Button
        isDisabled={readOnly || !canPublish || pending}
        onPress={() =>
          start(async () => {
            setError(undefined);
            const result = await publishResults(slug, true);
            if ("error" in result) setError(result.error);
          })
        }
      >
        {pending ? "Publishing…" : "Publish results"}
      </Button>
    </>
  );
}
