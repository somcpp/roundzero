"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Header, ListBox, Select, Separator } from "@heroui/react";
import { FieldLabel, Segmented, Stepper, Toggle } from "@/components/controls";
import { SaveError, UpdateButton } from "@/components/list-editor";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { Avatar, Eyebrow, ExplainerItem, PageHeader, Panel, TextLink, cn } from "@/components/ui";
import type { DistributionSettings, JudgeGroup, JudgingPhase } from "@/lib/data";
import { saveDistribution } from "@/lib/judging-actions";
import { JudgePhoto } from "../judges/judge-photo";

type InboxJudge = { id: string; name: string; title: string; imagePath: string | null };
/** The hackathon's owner, who can take the agent-failed inbox. */
type InboxAdmin = { name: string; email: string | null };

/** Inbox picks that aren't a judge id. */
const ADMIN = "__admin__";
const NOBODY = "__nobody__";

/** Rough minutes a judge spends per project, for the time estimate. */
const MINUTES_PER_PROJECT = 4;

const snapshot = (s: DistributionSettings) => JSON.stringify(s);

export function DistributionEditor({
  initial,
  phases,
  judges,
  admin,
  groups,
  projectCount,
  locked,
  slug,
}: {
  initial: DistributionSettings;
  phases: JudgingPhase[];
  judges: InboxJudge[];
  admin: InboxAdmin;
  groups: JudgeGroup[];
  projectCount: number;
  /** Judging has started, so nothing here can change. */
  locked: boolean;
  slug: string;
}) {
  // An inbox judge who has since been deleted hands the inbox back to the admin.
  const clean = (s: DistributionSettings): DistributionSettings =>
    s.failedInbox === "judge" && !judges.some((j) => j.id === s.inboxJudgeId)
      ? { ...s, failedInbox: "admin", inboxJudgeId: null }
      : s;
  const [settings, setSettings] = useState(() => clean(initial));
  const [saved, setSaved] = useState(() => clean(initial));
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startSave] = useTransition();

  const set = (patch: Partial<DistributionSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setJustSaved(false);
  };
  const dirty = snapshot(settings) !== snapshot(saved);
  const submit = () =>
    startSave(async () => {
      setError(undefined);
      const result = await saveDistribution(slug, settings);
      if ("error" in result) return setError(result.error);
      setSettings(result.settings);
      setSaved(result.settings);
      setJustSaved(true);
    });

  const inboxJudge = settings.failedInbox === "judge" ? judges.find((j) => j.id === settings.inboxJudgeId) : undefined;
  const loads = phaseLoads(phases, groups, judges.length, projectCount);
  const first = loads[0];

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <PageHeader
          title="Distribution"
          actions={!locked && <UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={submit} />}
        />
        <SaveError error={error} />
        {locked && (
          <div className="mb-3">
            <LockedNote>
              Judging has started, so these settings are locked. To change them,{" "}
              <TextLink href={`/h/${slug}/judging/progress`}>reset judging</TextLink> first.
            </LockedNote>
          </div>
        )}

        {/* Locked once judging starts: they decided the assignments already handed out. */}
        <fieldset disabled={locked} className="min-w-0 disabled:pointer-events-none disabled:opacity-60">
          <Panel className="divide-y divide-border">
            <Row label="Agent first" hint="The agent starts reviewing every project when judging starts. Judges don't wait for it">
              <Toggle checked={settings.agentFirst} onChange={(agentFirst) => set({ agentFirst })} />
            </Row>
            <Row
              label="Agent-failed inbox"
              hint={settings.agentFirst ? INBOX_HINT[settings.failedInbox] : "Only used with Agent first on"}
            >
              <InboxSelect
                admin={admin}
                judges={judges}
                settings={settings}
                isDisabled={locked || !settings.agentFirst}
                onChange={(failedInbox, inboxJudgeId) => set({ failedInbox, inboxJudgeId })}
              />
            </Row>
            <Row label="Strategy" hint={STRATEGY_HINT[settings.strategy]}>
              <Segmented
                value={settings.strategy}
                onChange={(strategy) => set({ strategy })}
                options={[
                  { value: "even", label: "Even split" },
                  { value: "mixed", label: "Mixed" },
                ]}
              />
            </Row>
            <div>
              <Row
                label="Cadence"
                hint={settings.cadence === "daily" ? "A new batch for each judge every 24 hours" : "Each judge's whole queue from the start"}
              >
                <Segmented
                  value={settings.cadence}
                  onChange={(cadence) => set({ cadence })}
                  options={[
                    { value: "once", label: "All at once" },
                    { value: "daily", label: "Daily batches" },
                  ]}
                />
              </Row>
              <Reveal show={settings.cadence === "daily"}>
                <SubRow label="Spread over" note={cadenceNote(settings.batchDays, first)}>
                  <Stepper value={settings.batchDays} onChange={(batchDays) => set({ batchDays })} min={1} max={30} />
                  <span className="text-sm text-muted">{settings.batchDays === 1 ? "day" : "days"}</span>
                </SubRow>
              </Reveal>
            </div>
            <Row label="Show agent score" hint="Revealed to judges after they submit; they can adjust once">
              <Toggle checked={settings.showAgentScore} onChange={(showAgentScore) => set({ showAgentScore })} />
            </Row>
            <div>
              <Row
                label="Failed gates"
                hint={
                  settings.judgeGate === "flag"
                    ? "A review that fails a gate flags the project, and you decide"
                    : "Enough reviews failing a gate rule the project out"
                }
              >
                <Segmented
                  value={settings.judgeGate}
                  onChange={(judgeGate) => set({ judgeGate })}
                  options={[
                    { value: "flag", label: "Flag it" },
                    { value: "rule_out", label: "Rule it out" },
                  ]}
                />
              </Row>
              <Reveal show={settings.judgeGate === "rule_out"}>
                <SubRow label="Rule out after" note={gateNote(settings.judgeGateCount)}>
                  <Stepper
                    value={settings.judgeGateCount}
                    onChange={(judgeGateCount) => set({ judgeGateCount })}
                    min={1}
                    max={20}
                  />
                  <span className="text-sm text-muted">failing {settings.judgeGateCount === 1 ? "review" : "reviews"}</span>
                </SubRow>
              </Reveal>
            </div>
          </Panel>
        </fieldset>

        <Preview
          settings={settings}
          inbox={
            settings.failedInbox === "admin" ? (
              <b>you</b>
            ) : inboxJudge ? (
              <b>{inboxJudge.name}</b>
            ) : (
              <span className="text-muted">nobody (dropped)</span>
            )
          }
          loads={loads}
          projectCount={projectCount}
          slug={slug}
        />
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-36 lg:self-start">
        <h2 className="text-lg leading-none">How it&apos;s used</h2>
        <p className="text-sm text-muted">
          These settings decide how projects are handed out when each phase starts. Every judge gets a private link with
          only their queue.
        </p>
        <ul className="flex flex-col gap-3 text-sm">
          <ExplainerItem icon="spark" title="Agent first">
            The agent reviews every project as soon as judging starts, running each criterion&apos;s mechanisms and
            checking the gates. Judges get their queues at the same time, so some reviews finish while they work.
          </ExplainerItem>
          <ExplainerItem icon="inbox" title="Inbox">
            A project the agent fails on a gate ranks last and can&apos;t win until someone looks. From the Inbox in the
            top bar, you agree and keep it out, or disagree and put it back in the pool. Picking a judge names them as the
            reviewer.
          </ExplainerItem>
          <ExplainerItem icon="users" title="Strategy">
            Even gives every judge the same count. Mixed also rotates pairings, so scores can be compared across
            judges.
          </ExplainerItem>
          <ExplainerItem icon="mail" title="Cadence">
            Daily batches keep queues short and stop judges from rushing the last day.
          </ExplainerItem>
          <ExplainerItem icon="eye" title="Agent score">
            Hidden until a judge submits, so it can&apos;t anchor their score.
          </ExplainerItem>
          <ExplainerItem icon="lock" title="Failed gates">
            When judges fail a gate criterion, either flag the project for you to decide, or rule it out once enough
            reviews agree. A ruled-out project ranks last, is eliminated when its phase closes and can&apos;t win an
            award.
          </ExplainerItem>
        </ul>
      </aside>
    </div>
  );
}

const STRATEGY_HINT: Record<DistributionSettings["strategy"], string> = {
  even: "Same number of projects per judge",
  mixed: "Same load, and no two judges share every project",
};

const INBOX_HINT: Record<DistributionSettings["failedInbox"], string> = {
  admin: "Projects the agent fails on a gate wait in your Inbox for a call",
  judge: "Projects the agent fails on a gate wait in your Inbox, marked for this judge to review",
  nobody: "Gate failures just stand: they rank last and can't win",
};

type PhaseLoad = ReturnType<typeof phaseLoads>[number];

/** Each phase's intake and how many projects each judge in its pool reviews. */
function phaseLoads(phases: JudgingPhase[], groups: JudgeGroup[], judgeCount: number, projectCount: number) {
  // Each phase gets what the one before advanced, never more than came into it.
  const intake = phases.reduce<number[]>(
    (acc, _, i) => [...acc, i === 0 ? projectCount : Math.min(acc[i - 1], phases[i - 1].advanceCount ?? 0)],
    [],
  );
  return phases.map((p, i) => {
    const incoming = intake[i];
    const group = p.judgeGroupId ? groups.find((g) => g.id === p.judgeGroupId) : undefined;
    const pool = group ? group.members.length : judgeCount;
    const perProject = Math.min(p.reviewsPerProject ?? pool, pool);
    const reviews = incoming * perProject;
    const lo = pool ? Math.floor(reviews / pool) : 0;
    const hi = pool ? Math.ceil(reviews / pool) : 0;
    return { phase: p, incoming, poolName: group?.name ?? "All judges", pool, perProject, reviews, lo, hi };
  });
}

/** What daily batches mean for a judge, with the first phase's numbers when there are any. */
function cadenceNote(days: number, first: PhaseLoad | undefined) {
  if (days === 1) return "One batch: each judge gets their whole queue on day one, the same as all at once.";
  const perDay = first && first.hi > 0 ? ` In ${first.phase.name} that's about ${Math.ceil(first.hi / days)} a day.` : "";
  return `Each judge gets 1/${days} of their queue every 24 hours, for ${days} days.${perDay} They can start the next batch early.`;
}

function gateNote(count: number) {
  const out = "the project is ruled out: it ranks last, is eliminated when the phase closes, and can't win an award.";
  if (count === 1) return `Once any review fails a gate, ${out}`;
  return `Once ${count} reviews fail the same gate, ${out} Fewer failing reviews just flag it for you.`;
}

function Preview({
  settings,
  inbox,
  loads,
  projectCount,
  slug,
}: {
  settings: DistributionSettings;
  /** Who gate failures go to. */
  inbox: ReactNode;
  loads: PhaseLoad[];
  projectCount: number;
  slug: string;
}) {
  return (
    <Panel className="mt-6 flex flex-col gap-5 bg-surface-secondary/40 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>Preview</Eyebrow>
        <TextLink href={`/h/${slug}/setup/phases`} className="text-sm text-muted">
          Edit phases
        </TextLink>
      </div>

      {settings.agentFirst && (
        <p className="flex items-start gap-2 text-sm">
          <PixelIcon name="spark" size={12} className="mt-1 text-accent" />
          <span>
            Agent reviews <b className="font-pixel">{projectCount}</b> {projectCount === 1 ? "project" : "projects"} when judging starts. Gate fails go to{" "}
            {inbox}.
          </span>
        </p>
      )}

      <ol className="flex flex-col divide-y divide-border rounded-lg border-2 border-border bg-surface">
        {loads.map((r, i) => (
          <li key={r.phase.id} className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]">
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">
                <span className="mr-2 font-pixel text-xs text-muted">{i + 1}</span>
                {r.phase.name}
              </span>
              <span className="text-muted">
                {r.incoming} {r.incoming === 1 ? "project" : "projects"} × {r.perProject} ÷ {r.pool} {r.pool === 1 ? "judge" : "judges"} · {r.poolName}
              </span>
            </span>
            <span className="flex flex-col sm:items-end">
              {r.pool === 0 ? (
                <span className="text-warning-soft-foreground">no judges in pool</span>
              ) : (
                <>
                  <b className="font-pixel text-accent">{r.lo === r.hi ? r.lo : `${r.lo}–${r.hi}`} each</b>
                  <span className="text-xs text-muted">
                    ~{r.hi * MINUTES_PER_PROJECT} min
                    {settings.cadence === "daily" && r.hi > 0 && ` · ~${Math.ceil(r.hi / settings.batchDays)}/day`}
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="flex items-center gap-2 text-xs text-muted">
        <PixelIcon name="link" size={10} />
        {projectCount === 0
          ? "Numbers fill in once projects are added."
          : `About ${MINUTES_PER_PROJECT} minutes per project. Each judge gets a private link with their queue (Setup › Judge portal).`}
      </p>
    </Panel>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-6 py-4">
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Slides a row's follow-up setting open under it, and out of the tab order when closed. */
function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      inert={!show}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** A follow-up setting inset under its row, with a sentence saying what it does. */
function SubRow({ label, note, children }: { label: string; note: ReactNode; children: ReactNode }) {
  return (
    <div className="px-6 pb-4">
      <div className="flex flex-col gap-2.5 rounded-lg border-l-4 border-accent/40 bg-surface-secondary/60 px-4 py-3 sm:ml-4">
        <div className="flex flex-wrap items-center gap-3">
          <FieldLabel className="mr-1">{label}</FieldLabel>
          {children}
        </div>
        <p className="text-sm text-muted">{note}</p>
      </div>
    </div>
  );
}

/** Picks who reviews agent-failed projects: the admin, one judge, or nobody. */
function InboxSelect({
  admin,
  judges,
  settings,
  isDisabled,
  onChange,
}: {
  admin: InboxAdmin;
  judges: InboxJudge[];
  settings: DistributionSettings;
  isDisabled: boolean;
  onChange: (failedInbox: DistributionSettings["failedInbox"], judgeId: string | null) => void;
}) {
  const judge = settings.failedInbox === "judge" ? judges.find((j) => j.id === settings.inboxJudgeId) : undefined;
  const value = judge ? judge.id : settings.failedInbox === "nobody" ? NOBODY : ADMIN;
  return (
    <Select
      aria-label="Agent-failed inbox"
      value={value}
      isDisabled={isDisabled}
      onChange={(key) => {
        if (!key) return;
        if (key === ADMIN) onChange("admin", null);
        else if (key === NOBODY) onChange("nobody", null);
        else onChange("judge", String(key));
      }}
      className="w-60"
    >
      <Select.Trigger className="min-h-11 gap-2 rounded-lg border-2 border-border bg-surface px-3 hover:border-border-strong data-[disabled]:opacity-50 data-[focus-visible]:border-accent">
        <Select.Value>
          {() =>
            judge ? (
              <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
                <JudgePhoto name={judge.name} imagePath={judge.imagePath} size={24} />
                <span className="truncate">{judge.name}</span>
              </span>
            ) : value === ADMIN ? (
              <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
                <Avatar name={admin.name} size={24} />
                <span className="truncate">{admin.name}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2.5 text-[15px] text-muted">
                <PixelIcon name="x" size={12} />
                Nobody — drop them
              </span>
            )
          }
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-64">
        <ListBox>
          <ListBox.Section>
            <Header>Admins</Header>
            <ListBox.Item id={ADMIN} textValue={admin.name}>
              <Avatar name={admin.name} size={28} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{admin.name}</span>
                <span className="truncate text-xs text-muted">
                  {admin.email && admin.email !== admin.name ? admin.email : "Hackathon owner"}
                </span>
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox.Section>
          {judges.length > 0 && (
            <>
              <Separator />
              <ListBox.Section>
                <Header>Judges</Header>
                {judges.map((j) => (
                  <ListBox.Item key={j.id} id={j.id} textValue={j.name}>
                    <JudgePhoto name={j.name} imagePath={j.imagePath} size={28} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{j.name}</span>
                      {j.title && <span className="truncate text-xs text-muted">{j.title}</span>}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            </>
          )}
          <Separator />
          <ListBox.Section>
            <ListBox.Item id={NOBODY} textValue="Nobody — drop them">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-secondary text-muted">
                <PixelIcon name="x" size={12} />
              </span>
              <span className="flex flex-col">
                <span>Nobody</span>
                <span className="text-xs text-muted">Failures stand: they rank last and can&apos;t win</span>
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox.Section>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
