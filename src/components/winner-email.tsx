import { PixelIcon } from "@/components/pixel-icon";
import { RewardImage } from "@/components/reward-image";
import { Eyebrow, LogoMark, PixelCover, cn } from "@/components/ui";
import {
  REWARD_EMAIL_DEFAULTS,
  fillEmailCopy,
  org,
  rewardIcon,
  type Hackathon,
  type RewardEmail,
  type RewardTier,
} from "@/lib/data";

export type EmailHackathon = Pick<Hackathon, "name" | "slug" | "logo" | "logoUrl" | "color"> &
  Partial<Pick<Hackathon, "bannerUrl">>;

/** The address winner emails come from, with the sender name from the email settings. */
export const emailSender = (hackathon: Pick<Hackathon, "name">, email: RewardEmail) =>
  `${email.fromName || hackathon.name} <hello@${org.domain.split("/")[0]}>`;

/** One winner's email: envelope lines, then the branded body listing every tier they collect. */
export function WinnerEmail({
  hackathon,
  email,
  projectName,
  rank,
  total,
  tiers,
  publicUrl,
  className,
}: {
  hackathon: EmailHackathon;
  email: RewardEmail;
  projectName: string;
  /** Final rank, or null for award-only winners. */
  rank: number | null;
  /** How many projects were ranked. */
  total: number;
  tiers: RewardTier[];
  /** Full URL of the public winners page; the path alone when the origin isn't known. */
  publicUrl?: string;
  className?: string;
}) {
  const fill = (copy: string) => fillEmailCopy(copy, { project: projectName, hackathon: hackathon.name, rank });
  const winnersUrl = publicUrl ?? `/w/${hackathon.slug}`;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="flex flex-col gap-1 border-b border-border px-6 py-4 text-sm">
        <span>
          <span className="text-muted">From:</span> {emailSender(hackathon, email)}
        </span>
        <span>
          <span className="text-muted">To:</span> the {projectName} team
        </span>
        <span>
          <span className="text-muted">Subject:</span> You won {tiers[0]?.name ?? "a prize"} at {hackathon.name} 🎉
        </span>
      </div>
      <div className="bg-surface-secondary/40 p-4 sm:p-8">
        <div className="mx-auto flex max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <PixelCover seed={hackathon.slug} color={hackathon.color} image={hackathon.bannerUrl} className="h-28">
            <div className="flex h-28 items-center justify-center">
              <LogoMark text={hackathon.logo} src={hackathon.logoUrl} color={hackathon.color} size={40} />
            </div>
          </PixelCover>
          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <Eyebrow className="text-accent">{hackathon.name} · Results</Eyebrow>
            <h2 className="text-2xl leading-tight">{fill(email.title || REWARD_EMAIL_DEFAULTS.title)}</h2>
            {email.description ? (
              <p className="text-sm whitespace-pre-line text-muted">{fill(email.description)}</p>
            ) : (
              <p className="text-sm text-muted">
                {rank ? (
                  <>
                    Out of {total} finalists, the judges ranked yours <b className="text-foreground">#{rank}</b>.
                  </>
                ) : (
                  <>The judges picked yours for {tiers.map((t) => t.name).join(" and ")}.</>
                )}{" "}
                Here&apos;s everything you&apos;ve earned:
              </p>
            )}
            {tiers.map((t) => (
              <div key={t.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <RewardImage name={t.name} imagePath={t.imagePath} size={48} />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-pixel text-sm">{t.name}</span>
                    {t.description && <span className="text-xs text-muted">{t.description}</span>}
                  </div>
                </div>
                {t.items.length > 0 && (
                  <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                    {t.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <PixelIcon name={rewardIcon[it.kind]} size={14} className="text-accent" />
                        <span className="flex-1">{it.label}</span>
                        {it.detail && (it.kind === "code" || it.kind === "credits") && (
                          <code className="rounded bg-surface-secondary px-2 py-0.5 text-xs">{it.detail}</code>
                        )}
                        {it.detail && (it.kind === "link" || it.kind === "file" || it.kind === "image") && (
                          <span className="text-xs text-accent">Open →</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {email.finePrint && <p className="text-xs whitespace-pre-line text-muted">{email.finePrint}</p>}
            {email.linkUrl && (
              <a
                href={email.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="self-start rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground"
              >
                {email.linkLabel || REWARD_EMAIL_DEFAULTS.linkLabel}
              </a>
            )}
            <p className="text-xs text-muted">
              See all winners at{" "}
              <a href={winnersUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {winnersUrl.replace(/^https?:\/\//, "")}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
