"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { LiveRefresh } from "@/components/live-refresh";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import type { AnnounceAudience, AnnounceStatus } from "@/lib/email/announce";
import { emailEveryoneElse, emailWinners } from "@/lib/email-actions";
import { formatNumber } from "@/lib/project-fields";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The two results emails, sent separately: winners get their prizes, and
 * everyone else gets the thank-you. Either can be skipped if you'd rather
 * reach people another way; the winners are still managed here.
 */
export function ResultsEmails({ slug, status }: { slug: string; status: AnnounceStatus }) {
  const sending = status.winners.sending + status.everyoneElse.sending > 0;
  return (
    <section>
      {/* Refresh while emails are going out, so the counts catch up. */}
      <LiveRefresh active={sending} />
      <SectionTitle
        hint={status.final ? "each goes once per project" : "once the last phase closes"}
        action={
          <Link href={`/h/${slug}/judging/rewards`} className="text-xs text-muted hover:text-foreground">
            Edit email copy
          </Link>
        }
      >
        Results emails
      </SectionTitle>
      <Panel className="divide-y divide-border">
        <Row
          slug={slug}
          audience={status.winners}
          title="Winners"
          blurb="Each winning project gets its prizes and how to claim them."
          disabled={!status.final ? "The ranking isn't final yet." : null}
          published={status.published}
          send={emailWinners}
          previewHref={`/h/${slug}/results/emails`}
        />
        <Row
          slug={slug}
          audience={status.everyoneElse}
          title="Everyone else"
          blurb="A thank-you to every other project, with the winners and any thank-you gift."
          disabled={
            !status.final
              ? "The ranking isn't final yet."
              : !status.thankYouEnabled
                ? "The thank-you email is switched off in its settings."
                : null
          }
          published={status.published}
          send={emailEveryoneElse}
          previewHref={`/h/${slug}/judging/rewards`}
        />
      </Panel>
    </section>
  );
}

function Row({
  slug,
  audience: a,
  title,
  blurb,
  disabled,
  published,
  send,
  previewHref,
}: {
  slug: string;
  audience: AnnounceAudience;
  title: string;
  blurb: string;
  /** Why it can't be sent yet, or null. */
  disabled: string | null;
  published: boolean;
  send: (slug: string) => Promise<{ error: string } | { queued: number }>;
  previewHref: string;
}) {
  const [queued, setQueued] = useState<number>();
  // Everyone who can be emailed has been (projects with no address can't be).
  const done = a.sent > 0 && a.ready === 0;
  const label = title === "Winners" ? "Email winners" : "Email everyone else";

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          <Badge>{plural(a.total, "project")}</Badge>
          {a.sent > 0 && (
            <Badge tone="success" dot>
              {a.sent} sent
            </Badge>
          )}
          {a.sending > 0 && (
            <Badge tone="accent" dot>
              {a.sending} sending
            </Badge>
          )}
          {a.failed > 0 && <Badge tone="danger">{a.failed} failed</Badge>}
        </span>
        <span className="text-sm text-muted">{disabled ?? blurb}</span>
        {a.noEmail.length > 0 && (
          <span className="text-xs text-muted">
            No contact email, so they&apos;ll be skipped:{" "}
            {a.noEmail
              .slice(0, 4)
              .map((p) => `${p.name} (${formatNumber(p.number)})`)
              .join(", ")}
            {a.noEmail.length > 4 && ` and ${a.noEmail.length - 4} more`}.{" "}
            <Link href={`/h/${slug}/judging/projects`} className="underline underline-offset-2 hover:text-foreground">
              Add them
            </Link>
          </span>
        )}
        {queued !== undefined && <span className="text-xs text-success">Sending {plural(queued, "email")} now.</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href={previewHref} className="text-xs text-muted hover:text-foreground">
          Preview
        </Link>
        <ConfirmButton
          variant={done ? "secondary" : "primary"}
          size="md"
          isDisabled={!!disabled || a.ready === 0}
          title={`${label}?`}
          description={
            <>
              This sends {plural(a.ready, "email")} now, one per project, from your hackathon. Projects already emailed
              are skipped, so it&apos;s safe to press again later.
              {!published && " The winners page isn't public yet, so its link in the email won't open until you publish."}
            </>
          }
          confirmLabel={`Send ${plural(a.ready, "email")}`}
          pendingLabel="Starting…"
          onConfirm={async () => {
            const result = await send(slug);
            if ("error" in result) return result.error;
            setQueued(result.queued);
          }}
        >
          <PixelIcon name="mail" size={12} />
          {done ? "All sent" : a.sent > 0 && a.ready > 0 ? `Email ${a.ready} more` : label}
        </ConfirmButton>
      </div>
    </div>
  );
}
