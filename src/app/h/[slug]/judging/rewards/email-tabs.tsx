"use client";

import { useState, useTransition, type ComponentType, type ReactNode } from "react";
import { Field, FieldLabel, Segmented, TextArea, TextInput, Toggle } from "@/components/controls";
import { EmailFrame } from "@/components/email-frame";
import { SaveError } from "@/components/list-editor";
import { Eyebrow, Panel, TextLink } from "@/components/ui";
import type { EmailHackathon } from "@/emails/_components/shell";
import ThankYouEmailTemplate, { type ThankYouEmailProps } from "@/emails/thank-you";
import WinnerEmailTemplate from "@/emails/winner";
import {
  REWARD_EMAIL_DEFAULTS,
  THANK_YOU_EMAIL_DEFAULTS,
  tiersForRank,
  type RewardEmail,
  type RewardTier,
  type ThankYouEmailSettings,
} from "@/lib/data";
import { saveRewardEmail } from "@/lib/reward-actions";
import { rewardImageUrl } from "@/lib/reward-images";
import { saveThankYouEmail } from "@/lib/thank-you-email-actions";
import { PrizeList } from "./prize-list";

// The Winner email and Thank-you email tabs on Judging › Rewards: the copy on
// the left, the real email (src/emails) rendered live on the right.

const MOCK_PROJECT = "Example Project";

/** Gift items the thank-you email allows (lib/thank-you-email-actions.ts). */
const MAX_BONUSES = 10;

// Trailing spaces don't make a draft unsaved.
const snapshot = (value: unknown) => JSON.stringify(value, (_, v) => (typeof v === "string" ? v.trim() : v));

/** Email settings being edited, saved on their own apart from the tiers. */
function useEmailDraft<T extends object>(initial: T, save: (email: T) => Promise<{ error: string } | { email: T }>) {
  const [email, setEmail] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startSave] = useTransition();
  const dirty = snapshot(email) !== snapshot(saved);

  const set = (patch: Partial<T>) => {
    setEmail((e) => ({ ...e, ...patch }));
    setJustSaved(false);
  };

  const submit = () =>
    startSave(async () => {
      setError(undefined);
      const result = await save(email);
      if ("error" in result) return setError(result.error);
      setEmail(result.email);
      setSaved(result.email);
      setJustSaved(true);
    });

  return { email, set, dirty, pending, error, justSaved, submit };
}

export const useWinnerEmailDraft = (initial: RewardEmail, slug: string) =>
  useEmailDraft(initial, (email) => saveRewardEmail(slug, email));

export const useThankYouEmailDraft = (initial: ThankYouEmailSettings, slug: string) =>
  useEmailDraft(initial, (email) => saveThankYouEmail(slug, email));

type Draft<T extends object> = ReturnType<typeof useEmailDraft<T>>;

// ── Winner email ──────────────────────────────────────────────────────────

/** The winner email's copy, beside the email a first-place team would get from the tiers as they are now. */
export function WinnerEmailTab({
  draft,
  hackathon,
  tiers,
  winnersUrl,
  slug,
}: {
  draft: Draft<RewardEmail>;
  hackathon: EmailHackathon;
  /** The tiers being edited, saved or not. */
  tiers: RewardTier[];
  winnersUrl: string;
  slug: string;
}) {
  const { email, set, error } = draft;
  const won = tiersForRank(tiers, 1);
  // Everyone a rank tier reaches counts as a finalist.
  const total = Math.max(1, ...tiers.map((t) => (t.recipients === "ranks" ? (t.rankTo ?? 0) : 0)));

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <SaveError error={error} />
        <p className="text-sm text-muted">
          Every winner gets this email with their own rewards listed. Use <code>{"{project}"}</code>,{" "}
          <code>{"{hackathon}"}</code> and <code>{"{rank}"}</code> in the title or description to fill in names and
          places. Blank fields use the default.
        </p>
        <Panel className="flex flex-col gap-6 p-6">
          <Field label="From name">
            <TextInput
              value={email.fromName}
              maxLength={80}
              placeholder={hackathon.name}
              onChange={(e) => set({ fromName: e.target.value })}
            />
          </Field>
          <Field label="Title">
            <TextInput
              value={email.title}
              maxLength={200}
              placeholder={REWARD_EMAIL_DEFAULTS.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={4}
              maxLength={2000}
              value={email.description}
              placeholder="Out of 42 finalists, the judges ranked yours #3. Here's everything you've earned:"
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <ButtonFields
            url={email.linkUrl}
            label={email.linkLabel}
            defaultLabel={REWARD_EMAIL_DEFAULTS.linkLabel}
            onChange={(linkUrl, linkLabel) => set({ linkUrl, linkLabel })}
          />
          <Field label="Fine print" hint="optional">
            <TextArea
              rows={4}
              maxLength={2000}
              value={email.finePrint}
              placeholder="Shown in small text under the list of rewards. Terms, deadlines to claim, tax notes…"
              onChange={(e) => set({ finePrint: e.target.value })}
            />
          </Field>
        </Panel>
      </div>

      <PreviewAside
        template={WinnerEmailTemplate}
        props={
          won.length === 0
            ? null
            : {
                hackathon,
                email,
                projectName: MOCK_PROJECT,
                rank: 1,
                total,
                tiers: won.map((t) => ({
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  items: t.items,
                  imageUrl: rewardImageUrl(t.imagePath),
                })),
                winnersUrl,
              }
        }
        title="Winner email preview"
        empty="No tier covers rank 1 yet, so first place wouldn't get an email. Add a Final rank tier that starts at 1."
        caption={
          <>
            What the first-place team would get, with a made-up project name. Unsaved changes show here too.{" "}
            <TextLink href={`/h/${slug}/results/emails`}>All winner emails</TextLink>
          </>
        }
      />
    </div>
  );
}

// ── Thank-you email ───────────────────────────────────────────────────────

export type ThankYouPreview = {
  stats: ThankYouEmailProps["stats"];
  /** Winners as the results stand now; empty before there are any. */
  winners: ThankYouEmailProps["winners"];
  /** e.g. "Reached round 2 of 2", for the made-up project; null with one phase. */
  milestone: string | null;
};

/** Made-up winners from the tiers, until there are results to show. */
function sampleWinners(tiers: RewardTier[]): ThankYouEmailProps["winners"] {
  const winners: ThankYouEmailProps["winners"] = [];
  for (let rank = 1; rank <= 3; rank++) {
    const won = tiersForRank(tiers, rank);
    if (won.length) winners.push({ id: `rank-${rank}`, name: "", pitch: "", rank, prize: won.map((t) => t.name).join(" + ") });
  }
  for (const t of tiers.filter((t) => t.recipients === "award").slice(0, 2)) {
    winners.push({ id: t.id, name: "", pitch: "", rank: null, prize: t.name });
  }
  return winners.map((w, i) => ({ ...w, name: `Project ${String.fromCharCode(65 + i)}` }));
}

/** The thank-you email's copy, winners and bonuses, beside the email a project that didn't win would get. */
export function ThankYouEmailTab({
  draft,
  hackathon,
  preview,
  tiers,
  winnersUrl,
}: {
  draft: Draft<ThankYouEmailSettings>;
  hackathon: EmailHackathon;
  preview: ThankYouPreview;
  /** The tiers being edited, for sample winners before there are results. */
  tiers: RewardTier[];
  winnersUrl: string;
}) {
  const { email, set, error } = draft;
  const real = preview.winners.length > 0;
  const winners = real ? preview.winners : sampleWinners(tiers);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <SaveError error={error} />
        <p className="text-sm text-muted">
          Goes to every project that didn&apos;t win, once results are out: thanks for building, who won, and a bonus for
          everyone if you add one. Use <code>{"{project}"}</code> and <code>{"{hackathon}"}</code> in the subject, title
          or message. Blank fields use the default.
        </p>

        <Panel className="p-6">
          <Toggle
            checked={email.enabled}
            onChange={(enabled) => set({ enabled })}
            label="Send a thank-you email"
            description="Off, and projects that didn't win don't get an email."
          />
        </Panel>

        <Panel className="flex flex-col gap-6 p-6">
          <h2 className="text-lg leading-none">Message</h2>
          <Field label="From name">
            <TextInput
              value={email.fromName}
              maxLength={80}
              placeholder={hackathon.name}
              onChange={(e) => set({ fromName: e.target.value })}
            />
          </Field>
          <Field label="Subject">
            <TextInput
              value={email.subject}
              maxLength={200}
              placeholder={THANK_YOU_EMAIL_DEFAULTS.subject}
              onChange={(e) => set({ subject: e.target.value })}
            />
          </Field>
          <Field label="Title">
            <TextInput
              value={email.title}
              maxLength={200}
              placeholder={THANK_YOU_EMAIL_DEFAULTS.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field label="Message">
            <TextArea
              rows={5}
              maxLength={2000}
              value={email.message}
              placeholder={THANK_YOU_EMAIL_DEFAULTS.message}
              onChange={(e) => set({ message: e.target.value })}
            />
          </Field>
          <Toggle
            checked={email.showWinners}
            onChange={(showWinners) => set({ showWinners })}
            label="Announce the winners"
            description="Lists up to six winners with their prizes, and links to the winners page."
          />
        </Panel>

        <Panel className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg leading-none">Bonus for everyone</h2>
            <p className="text-sm text-muted">
              A thank-you gift every team gets, win or not: a credits code, a discount link, swag. Leave it empty and the
              email has no gift.
            </p>
          </div>
          <Field label="Heading">
            <TextInput
              value={email.giftTitle}
              maxLength={120}
              placeholder={THANK_YOU_EMAIL_DEFAULTS.giftTitle}
              onChange={(e) => set({ giftTitle: e.target.value })}
            />
          </Field>
          <Field label="Description" hint="optional">
            <TextArea
              rows={2}
              maxLength={500}
              value={email.giftDescription}
              placeholder="Everyone who shipped a project gets these. Thanks for building with us."
              onChange={(e) => set({ giftDescription: e.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <FieldLabel>Bonuses</FieldLabel>
            <PrizeList
              tierName="thank-you gift"
              noun="bonus"
              max={MAX_BONUSES}
              empty="No bonuses yet. Add a link, a code or credits, and it goes straight into the email."
              items={email.giftItems}
              onChange={(giftItems) => set({ giftItems })}
            />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-6 p-6">
          <ButtonFields
            url={email.linkUrl}
            label={email.linkLabel}
            defaultLabel={THANK_YOU_EMAIL_DEFAULTS.linkLabel}
            hint="An extra button under the bonus, e.g. RSVP for demo night or join the community."
            onChange={(linkUrl, linkLabel) => set({ linkUrl, linkLabel })}
          />
          <Field label="Fine print" hint="optional">
            <TextArea
              rows={3}
              maxLength={2000}
              value={email.finePrint}
              placeholder="Shown in small text under the bonus. How to redeem, when codes expire…"
              onChange={(e) => set({ finePrint: e.target.value })}
            />
          </Field>
        </Panel>
      </div>

      <PreviewAside
        template={ThankYouEmailTemplate}
        props={{
          hackathon,
          email,
          project: { name: MOCK_PROJECT, reviews: 3, milestone: preview.milestone },
          stats: preview.stats,
          winners,
          winnersUrl,
        }}
        title="Thank-you email preview"
        notice={email.enabled ? undefined : "Turned off: nobody gets this email until you switch it back on."}
        caption={
          real
            ? "What a project that didn't win would get, with a made-up name and the winners as the results stand now."
            : "What a project that didn't win would get. The winners are made up until there are results."
        }
      />
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────

/** A button's link and label. Without a link, the email has no button. */
function ButtonFields({
  url,
  label,
  defaultLabel,
  hint,
  onChange,
}: {
  url: string;
  label: string;
  defaultLabel: string;
  hint?: string;
  onChange: (url: string, label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Button</FieldLabel>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
        <TextInput
          type="url"
          aria-label="Link"
          value={url}
          maxLength={2000}
          placeholder="https://… (optional)"
          onChange={(e) => onChange(e.target.value, label)}
        />
        <TextInput
          aria-label="Link name"
          value={label}
          maxLength={60}
          placeholder={defaultLabel}
          onChange={(e) => onChange(url, e.target.value)}
        />
      </div>
      <span className="text-xs text-muted">Leave the link blank and the email has no button.</span>
    </div>
  );
}

/** The live email, sticky beside the form, at desktop or phone width. */
function PreviewAside<P extends object>({
  template,
  props,
  title,
  empty,
  notice,
  caption,
}: {
  template: ComponentType<P>;
  /** Null shows `empty` instead of an email. */
  props: P | null;
  title: string;
  empty?: ReactNode;
  notice?: ReactNode;
  caption: ReactNode;
}) {
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");
  return (
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-36 lg:self-start">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Preview</Eyebrow>
        <Segmented
          size="sm"
          value={width}
          onChange={setWidth}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "phone", label: "Phone" },
          ]}
        />
      </div>
      {notice && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">{notice}</p>}
      {props === null ? (
        <p className="rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted">{empty}</p>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto rounded-xl border-2 border-border shadow-block">
          <EmailFrame template={template} props={props} width={width} title={title} />
        </div>
      )}
      <p className="text-xs text-muted">{caption}</p>
    </aside>
  );
}
