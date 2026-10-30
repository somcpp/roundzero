"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Tabs } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FieldLabel, Segmented, Stepper, TextArea, TextInput, Toggle } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError, UpdateButton, useListEditor } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { SortableList } from "@/components/sortable-list";
import { Badge, Chip, Eyebrow, ExplainerItem, PageHeader, TextLink, cn } from "@/components/ui";
import {
  rewardIcon,
  rewardWinners,
  tiersForRank,
  type RewardEmail,
  type RewardSettings,
  type RewardTier,
  type ThankYouEmailSettings,
} from "@/lib/data";
import { saveRewardSettings, saveRewardTiers } from "@/lib/reward-actions";
import { discardRewardImage, uploadRewardImage } from "@/lib/reward-images";
import { RewardImage } from "@/components/reward-image";
import type { EmailHackathon } from "@/emails/_components/shell";
import {
  ThankYouEmailTab,
  WinnerEmailTab,
  useThankYouEmailDraft,
  useWinnerEmailDraft,
  type ThankYouPreview,
} from "./email-tabs";
import { DETAIL, PrizeList } from "./prize-list";

const snapshot = (ts: RewardTier[]) =>
  JSON.stringify(
    ts.map((t) => [
      t.id,
      t.name,
      t.description,
      t.recipients,
      t.recipients === "ranks" && [t.rankFrom, t.rankTo],
      t.recipients === "award" && [t.winnerCount, t.pick, t.pick === "criterion" && t.criterionId, t.exclusive],
      t.imagePath,
      t.items.map((i) => [i.id, i.kind, i.label, DETAIL[i.kind] ? i.detail : ""]),
    ]),
  );

type CriterionOption = { id: string; title: string };

export type RewardsTab = "prizes" | "winner-email" | "thank-you-email";

/** A dot on a tab with unsaved changes. */
const UnsavedDot = ({ show }: { show: boolean }) =>
  show ? <span className="size-1.5 rounded-full bg-accent" aria-label="Unsaved changes" /> : null;

export function RewardsEditor({
  initial,
  initialEmail,
  initialThankYou,
  initialSettings,
  initialTab,
  hasTeamField,
  hackathon,
  thankYouPreview,
  winnersUrl,
  criteria,
  hackathonId,
  slug,
}: {
  initial: RewardTier[];
  initialEmail: RewardEmail;
  initialThankYou: ThankYouEmailSettings;
  initialSettings: RewardSettings;
  /** ?tab=winner-email or ?tab=thank-you-email opens straight on an email. */
  initialTab: RewardsTab;
  /** The project schema has a Team field, which one prize per team matches entrants by. */
  hasTeamField: boolean;
  hackathon: EmailHackathon;
  thankYouPreview: ThankYouPreview;
  /** Full URL of the public winners page, for the email previews. */
  winnersUrl: string;
  criteria: CriterionOption[];
  hackathonId: string;
  slug: string;
}) {
  const { items, saved, edit, dirty, pending, error, justSaved, submit } = useListEditor(
    initial,
    (xs) => saveRewardTiers(slug, xs),
    snapshot,
  );
  const [tab, setTab] = useState<RewardsTab>(initialTab);
  const [editing, setEditing] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const winnerEmail = useWinnerEmailDraft(initialEmail, slug);
  const thankYouEmail = useThankYouEmailDraft(initialThankYou, slug);
  const rewardSettings = useRewardSettings(initialSettings, slug);
  const current = items.find((t) => t.id === editing);

  const switchTab = (next: RewardsTab) => {
    setTab(next);
    // Keep the tab in the address, so a reload or a shared link opens on it.
    const url = new URL(window.location.href);
    if (next === "prizes") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  // An image that isn't on any saved tier was uploaded in this session and
  // can go straight back out of the bucket when it's replaced or dropped.
  const savedImages = new Set(saved.map((t) => t.imagePath));
  const discardIfUnsaved = (path: string | null) => {
    if (path && !savedImages.has(path)) void discardRewardImage(path);
  };

  const update = (id: string, patch: Partial<RewardTier>) =>
    edit((xs) => xs.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addTier = (at: number) => {
    const id = crypto.randomUUID();
    const next = Math.min(1000, Math.max(0, ...items.map((t) => (t.recipients === "ranks" ? (t.rankTo ?? 0) : 0))) + 1);
    const tier: RewardTier = {
      id,
      name: "New tier",
      description: "",
      recipients: "ranks",
      rankFrom: next,
      rankTo: next,
      winnerCount: null,
      pick: null,
      criterionId: null,
      exclusive: true,
      imagePath: null,
      items: [],
    };
    edit((xs) => [...xs.slice(0, at), tier, ...xs.slice(at)]);
    setEditing(id);
  };

  const draft = tab === "winner-email" ? winnerEmail : tab === "thank-you-email" ? thankYouEmail : null;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Rewards"
        hint="The prizes, and the emails winners and everyone else get when results are out."
        actions={
          draft ? (
            <UpdateButton dirty={draft.dirty} pending={draft.pending} justSaved={draft.justSaved} onPress={draft.submit} />
          ) : (
            <>
              <Button variant="ghost" onPress={() => setSettingsOpen(true)}>
                <PixelIcon name="gear" size={12} /> Settings
              </Button>
              <UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={submit} />
            </>
          )
        }
      />

      <Tabs selectedKey={tab} onSelectionChange={(k) => switchTab(k as RewardsTab)} className="w-full">
        <Tabs.ListContainer className="self-start">
          <Tabs.List aria-label="Rewards">
            <Tabs.Tab id="prizes" className="gap-1.5">
              <PixelIcon name="gift" size={12} />
              Prizes
              <UnsavedDot show={dirty} />
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="winner-email" className="gap-1.5">
              <PixelIcon name="trophy" size={12} />
              Winner email
              <UnsavedDot show={winnerEmail.dirty} />
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="thank-you-email" className="gap-1.5">
              <PixelIcon name="mail" size={12} />
              Thank-you email
              <UnsavedDot show={thankYouEmail.dirty} />
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="prizes" className="px-0 pt-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
            <div>
              <SaveError error={error} />

              <SortableList
                items={items}
                onReorder={(next) => edit(() => next)}
                selectedId={editing}
                onSelect={setEditing}
                onInsert={addTier}
                addLabel="add reward tier"
                renderItem={(t, { selected }) => (
                  <>
                    <RewardImage name={t.name} imagePath={t.imagePath} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium tracking-wider">{t.name || "Untitled"}</span>
                      <span className="truncate text-sm text-muted">
                        {t.items.length ? t.items.map((i) => i.label || i.kind).join(" · ") : "No prizes yet"}
                      </span>
                    </span>
                    <span className="hidden items-center gap-1.5 text-muted sm:flex">
                      {[...new Set(t.items.map((i) => i.kind))].map((k) => (
                        <PixelIcon key={k} name={rewardIcon[k]} size={12} aria-label={k} />
                      ))}
                    </span>
                    <Badge tone={selected ? "accent" : "neutral"}>{rewardWinners(t)}</Badge>
                  </>
                )}
              />
            </div>

            <aside className="flex flex-col gap-8 lg:sticky lg:top-36 lg:self-start">
              <ByRank tiers={items} oneWinPerEntrant={rewardSettings.settings.oneWinPerEntrant} />

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <h2 className="text-lg leading-none">How it&apos;s used</h2>
                <p className="text-sm text-muted">
                  Each tier is a prize. When results are published, every winner&apos;s email lists exactly what they
                  earned across all the tiers they land in.
                </p>
                <ul className="flex flex-col gap-3 text-sm">
                  <ExplainerItem icon="trophy" title="Final rank">
                    Top X prizes. When the last phase closes, projects are ranked by score and each rank collects every
                    tier whose range it falls in.
                  </ExplainerItem>
                  <ExplainerItem icon="crown" title="Awards">
                    Best of, most creative, best demo. Winners are picked on the Winners page, with suggestions from
                    the top scores on a criterion.
                  </ExplainerItem>
                  <ExplainerItem icon="gift" title="Prizes">
                    Cash, credits, codes, links, files or swag. Add a code or URL and it goes straight into the email.
                  </ExplainerItem>
                  <ExplainerItem icon="image" title="Prize image">
                    A square picture of the prize, shown on the winners page and in emails.
                  </ExplainerItem>
                  <ExplainerItem icon="mail" title="Emails">
                    The Winner email and Thank-you email tabs set what winners, and everyone who didn&apos;t win, get.
                    The thank-you email can carry a bonus for every team.
                  </ExplainerItem>
                  <ExplainerItem icon="gear" title="Settings">
                    Rules across every tier, like one prize per team so several entries from one team can&apos;t
                    sweep the board.
                  </ExplainerItem>
                </ul>
              </div>
            </aside>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="winner-email" className="px-0 pt-8">
          <WinnerEmailTab draft={winnerEmail} hackathon={hackathon} tiers={items} winnersUrl={winnersUrl} slug={slug} />
        </Tabs.Panel>

        <Tabs.Panel id="thank-you-email" className="px-0 pt-8">
          <ThankYouEmailTab
            draft={thankYouEmail}
            hackathon={hackathon}
            preview={thankYouPreview}
            tiers={items}
            winnersUrl={winnersUrl}
          />
        </Tabs.Panel>
      </Tabs>

      <EditDrawer
        isOpen={!!current}
        onClose={() => setEditing(null)}
        eyebrow="Reward tier"
        title={current?.name || "Untitled"}
        footer={
          current && (
            <div className="flex w-full items-center justify-between">
              <ConfirmButton
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="Remove tier"
                className="text-muted hover:bg-danger-soft hover:text-danger"
                title={`Remove “${current.name || "Untitled"}”?`}
                description="Its prizes come out of winner emails once you update, and its prize image is deleted."
                confirmLabel="Remove tier"
                onConfirm={() => {
                  discardIfUnsaved(current.imagePath);
                  edit((xs) => xs.filter((x) => x.id !== current.id));
                  setEditing(null);
                }}
              >
                <PixelIcon name="trash" size={14} />
              </ConfirmButton>
              <Button onPress={() => setEditing(null)}>Done</Button>
            </div>
          )
        }
      >
        {current && (
          <TierFields
            key={current.id}
            tier={current}
            criteria={criteria}
            hackathonId={hackathonId}
            onChange={(patch) => update(current.id, patch)}
            onDiscardImage={discardIfUnsaved}
          />
        )}
      </EditDrawer>

      <RewardSettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={rewardSettings}
        hasTeamField={hasTeamField}
        slug={slug}
      />
    </div>
  );
}

const settingsSnapshot = (s: RewardSettings) => JSON.stringify([s.oneWinPerEntrant]);

/** Hackathon-wide reward rules being edited, saved on their own apart from the tiers. */
function useRewardSettings(initial: RewardSettings, slug: string) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startSave] = useTransition();
  const dirty = settingsSnapshot(settings) !== settingsSnapshot(saved);

  const set = (patch: Partial<RewardSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setJustSaved(false);
  };

  const save = () =>
    startSave(async () => {
      setError(undefined);
      const result = await saveRewardSettings(slug, settings);
      if ("error" in result) return setError(result.error);
      setSettings(result.settings);
      setSaved(result.settings);
      setJustSaved(true);
    });

  return { settings, set, dirty, pending, error, justSaved, save };
}

/** Drawer for rules that apply across every tier and award. */
function RewardSettingsDrawer({
  isOpen,
  onClose,
  settings,
  hasTeamField,
  slug,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: ReturnType<typeof useRewardSettings>;
  /** The project schema has a Team field to match entrants by. */
  hasTeamField: boolean;
  slug: string;
}) {
  const { settings: s, set, dirty, pending, error, justSaved, save } = settings;

  return (
    <EditDrawer
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Rewards"
      title="Reward settings"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={save} />
        </div>
      }
    >
      <SaveError error={error} />
      <p className="text-sm text-muted">Rules for every tier and award. Results follow them as soon as you update.</p>

      <div className="flex flex-col gap-3">
        <Toggle
          checked={s.oneWinPerEntrant}
          onChange={(oneWinPerEntrant) => set({ oneWinPerEntrant })}
          label="One prize per team"
          description="A person or team with several submissions wins at most one reward. Their best-placed project keeps its prize; the next project moves up."
        />
        <div className="flex flex-col gap-2 pl-15 text-sm text-muted">
          <p>
            Projects count as the same team when they share a member in a Team field, ignoring case and extra
            spaces. Awards follow it too: a team that already wins something can&apos;t be picked for another award.
          </p>
          {!hasTeamField && (
            <p className="rounded-lg bg-surface-secondary px-3 py-2">
              The project schema has no Team field yet, so every project counts as its own team. Add one in{" "}
              <TextLink href={`/h/${slug}/setup/schema`}>Setup › Schema</TextLink>.
            </p>
          )}
        </div>
      </div>
    </EditDrawer>
  );
}

type TierTab = "details" | "winners" | "prizes";

function TierFields({
  tier: t,
  criteria,
  hackathonId,
  onChange,
  onDiscardImage,
}: {
  tier: RewardTier;
  criteria: CriterionOption[];
  hackathonId: string;
  onChange: (patch: Partial<RewardTier>) => void;
  onDiscardImage: (path: string | null) => void;
}) {
  // Keyed by tier, so a different tier opens on Details again.
  const [tab, setTab] = useState<TierTab>("details");

  return (
    <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as TierTab)} className="gap-0">
      {/* The tabs stay put while a long tier scrolls under them. */}
      <div className="sticky top-0 z-10 -mx-[3px] bg-overlay px-[3px] pb-5">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Tier settings">
            <Tabs.Tab id="details">
              Details
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="winners">
              Winners
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="prizes">
              Prizes
              {t.items.length > 0 && (
                <span className="ml-1.5 rounded-md bg-surface-secondary px-1.5 py-0.5 text-xs leading-none tabular-nums text-muted">
                  {t.items.length}
                </span>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </div>

      <Tabs.Panel id="details" className="mt-0 flex flex-col gap-5 p-0">
        <PrizeImage tier={t} hackathonId={hackathonId} onChange={onChange} onDiscard={onDiscardImage} />
        <Field label="Name">
          <TextInput value={t.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Description" hint="optional">
          <TextArea
            rows={3}
            maxLength={500}
            value={t.description}
            placeholder="Shown under the prize name in winner emails."
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
      </Tabs.Panel>

      <Tabs.Panel id="winners" className="mt-0 flex flex-col gap-5 p-0">
        <WinnerFields tier={t} criteria={criteria} onChange={onChange} />
      </Tabs.Panel>

      <Tabs.Panel id="prizes" className="mt-0 flex flex-col gap-3 p-0">
        <p className="text-sm text-muted">
          What each winner of this tier gets, in the order their email lists it. Add a code or URL and it goes
          straight into the email.
        </p>
        <PrizeList tierName={t.name} items={t.items} onChange={(items) => onChange({ items })} />
      </Tabs.Panel>
    </Tabs>
  );
}

/** Who wins a tier: a range of final ranks, or an award and how it's picked. */
function WinnerFields({
  tier: t,
  criteria,
  onChange,
}: {
  tier: RewardTier;
  criteria: CriterionOption[];
  onChange: (patch: Partial<RewardTier>) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <FieldLabel>Who wins</FieldLabel>
        <Segmented
          size="sm"
          value={t.recipients}
          onChange={(recipients) =>
            onChange(
              recipients === "ranks"
                ? { recipients, rankFrom: t.rankFrom ?? 1, rankTo: t.rankTo ?? t.rankFrom ?? 1, winnerCount: null, pick: null, criterionId: null }
                : { recipients, rankFrom: null, rankTo: null, winnerCount: t.winnerCount ?? 1, pick: t.pick ?? "manual" },
            )
          }
          options={[
            { value: "ranks", label: "Final rank" },
            { value: "award", label: "Award" },
          ]}
        />
        {t.recipients === "ranks" && (
          <>
            <div className="flex items-center gap-3 text-sm">
              <span>Ranks</span>
              <span className="w-20 shrink-0">
                <RankInput label="From rank" value={t.rankFrom} onChange={(rankFrom) => onChange({ rankFrom })} />
              </span>
              <span className="text-muted">to</span>
              <span className="w-20 shrink-0">
                <RankInput label="To rank" value={t.rankTo} onChange={(rankTo) => onChange({ rankTo })} />
              </span>
            </div>
            {t.rankFrom !== null && t.rankTo !== null && t.rankFrom > t.rankTo ? (
              <span className="text-xs text-danger">The first rank should come before the last.</span>
            ) : (
              <span className="text-xs text-muted">
                Every project that finishes in this range gets it. Ranges can overlap, so a winner can stack tiers.
              </span>
            )}
          </>
        )}
      </div>

      {t.recipients === "award" && <AwardFields tier={t} criteria={criteria} onChange={onChange} />}
    </>
  );
}

function RankInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <TextInput
      type="number"
      min={1}
      max={1000}
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Math.round(Number(e.target.value)))}
    />
  );
}

/** Square drop zone for the tier's prize image. Uploads straight to storage; the path saves with the tier. */
function PrizeImage({
  tier: t,
  hackathonId,
  onChange,
  onDiscard,
}: {
  tier: RewardTier;
  hackathonId: string;
  onChange: (patch: Partial<RewardTier>) => void;
  onDiscard: (path: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const readOnly = useReadOnly();

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    const result = await uploadRewardImage(hackathonId, t.id, file);
    setUploading(false);
    if ("error" in result) return setError(result.error);
    onDiscard(t.imagePath);
    onChange({ imagePath: result.path });
  };

  return (
    <div className="flex flex-col gap-2">
      <SaveError error={error} />
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={t.imagePath ? "Replace prize image" : "Upload prize image"}
          disabled={readOnly}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!readOnly) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!readOnly) void upload(e.dataTransfer.files[0]);
          }}
          className={cn(
            "relative shrink-0 cursor-pointer rounded-lg ring-offset-2 ring-offset-surface transition disabled:cursor-default",
            dragging ? "ring-4 ring-accent" : "enabled:hover:ring-2 enabled:hover:ring-border-secondary",
          )}
        >
          <RewardImage name={t.name} imagePath={t.imagePath} size={96} className="rounded-lg" />
          {uploading && (
            <span className="absolute inset-0 grid place-items-center rounded-lg bg-background/70 font-pixel text-xs">…</span>
          )}
        </button>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" isDisabled={readOnly || uploading} onPress={() => fileInput.current?.click()}>
              <PixelIcon name="image" size={12} />
              {uploading ? "Uploading…" : t.imagePath ? "Replace" : "Upload image"}
            </Button>
            {t.imagePath && (
              <ConfirmButton
                variant="ghost"
                size="sm"
                title="Remove this prize image?"
                description="The tier shows a gift icon instead once you update."
                confirmLabel="Remove image"
                onConfirm={() => {
                  onDiscard(t.imagePath);
                  onChange({ imagePath: null });
                }}
              >
                Remove
              </ConfirmButton>
            )}
          </div>
          <span className="text-xs text-muted">Drop an image or click. It&apos;s cropped to a centered square.</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/** Which tiers each finishing position collects, grouped into runs of ranks that get the same thing. */
function ByRank({ tiers, oneWinPerEntrant }: { tiers: RewardTier[]; oneWinPerEntrant?: boolean }) {
  const last = Math.min(
    50,
    Math.max(0, ...tiers.map((t) => (t.recipients === "ranks" && t.rankFrom !== null && t.rankTo !== null ? t.rankTo : 0))),
  );
  const runs: { from: number; to: number; names: string[] }[] = [];
  for (let r = 1; r <= last; r++) {
    const names = tiersForRank(tiers, r).map((t) => t.name || "Untitled");
    const prev = runs.at(-1);
    if (prev && prev.to === r - 1 && prev.names.join("\n") === names.join("\n")) prev.to = r;
    else runs.push({ from: r, to: r, names });
  }
  const awards = tiers.filter((t) => t.recipients === "award");

  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>What each winner gets</Eyebrow>
      {runs.length === 0 && awards.length === 0 ? (
        <p className="text-sm text-muted">Add a tier to see who gets what.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {runs
            .filter((run) => run.names.length)
            .map((run) => (
              <li key={run.from} className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 font-pixel text-xs">
                  {run.from === run.to ? `#${run.from}` : `#${run.from}–${run.to}`}
                </span>
                <span className="min-w-0 flex-1">{run.names.join(" + ")}</span>
              </li>
            ))}
          {awards.map((t) => (
            <li key={t.id} className="flex items-baseline gap-3">
              <span className="w-14 shrink-0 text-xs text-muted">Award</span>
              <span className="min-w-0 flex-1">
                {t.name || "Untitled"}
                {t.winnerCount && t.winnerCount > 1 && <span className="text-muted"> × {t.winnerCount}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {oneWinPerEntrant && (
        <p className="text-xs text-muted">One prize per team: places skip teams that already won.</p>
      )}
    </div>
  );
}

function AwardFields({
  tier: t,
  criteria,
  onChange,
}: {
  tier: RewardTier;
  criteria: CriterionOption[];
  onChange: (patch: Partial<RewardTier>) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel>How many</FieldLabel>
          <Stepper value={t.winnerCount ?? 1} onChange={(winnerCount) => onChange({ winnerCount })} min={1} max={50} />
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>Picked</FieldLabel>
          <Segmented
            size="sm"
            value={t.pick ?? "manual"}
            onChange={(pick) => onChange({ pick, criterionId: pick === "criterion" ? (t.criterionId ?? criteria[0]?.id ?? null) : null })}
            options={[
              { value: "manual", label: "By hand" },
              { value: "criterion", label: "Top on a criterion" },
            ]}
          />
        </div>
      </div>

      {t.pick === "criterion" && (
        <div className="flex flex-col gap-2">
          <FieldLabel>Suggested by</FieldLabel>
          {criteria.length === 0 ? (
            <span className="text-sm text-muted">Add criteria in Setup › Criteria first.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {criteria.map((c) => (
                <Chip key={c.id} active={t.criterionId === c.id} onClick={() => onChange({ criterionId: c.id })}>
                  {c.title}
                </Chip>
              ))}
            </div>
          )}
          <span className="text-xs text-muted">
            Projects with the best average judge score on this criterion are suggested; you still confirm the
            winner.
          </span>
        </div>
      )}

      <Toggle
        checked={t.exclusive}
        onChange={(exclusive) => onChange({ exclusive })}
        label="Only projects without a rank prize"
        description="Keeps prizes spread out: a top-ranked project can't also take this award."
      />
    </>
  );
}
