"use client";

import { useState, type ReactNode } from "react";
import { Button, Tabs } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FieldLabel, Segmented, Stepper, TagInput, TextArea, TextInput, Toggle } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError, UpdateButton, useListEditor } from "@/components/list-editor";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { SortableList } from "@/components/sortable-list";
import { Badge, Chip, Eyebrow, ExplainerItem, PageHeader, TextLink, cn } from "@/components/ui";
import { DOUBLE_CHECKS, MODEL_TIERS, modelName } from "@/lib/agent/tiers";
import { saveCriteria } from "@/lib/criteria-actions";
import {
  DEFAULT_AGENT_SETTINGS,
  blockTypes,
  mechanisms,
  type Criterion,
  type IconName,
  type Mechanism,
  type ModelTier,
  type SchemaBlock,
} from "@/lib/data";

const SHADES = [1, 0.7, 0.45, 0.25, 0.15];
const mechanismInfo = (m: Mechanism) => mechanisms.find((x) => x.id === m) ?? mechanisms[0];
const blockIcon = (b: SchemaBlock) => blockTypes.find((t) => t.type === b.type)?.icon ?? "text";

const snapshot = (cs: Criterion[]) =>
  JSON.stringify(
    cs.map((c) => [
      c.id,
      c.title,
      c.scale,
      c.description,
      [...c.inputs].sort(),
      [...c.mechanisms].sort(),
      c.weight,
      c.ifMissing,
      c.scale === "pass_fail" && c.gate,
      c.agentGuidance.trim(),
      c.agentModel,
      c.lookFor,
      c.sandboxCommands.trim(),
      c.doubleCheck,
    ]),
  );

/** Only human judges score it, so the agent settings don't apply. */
const judgesOnly = (c: Criterion) => c.mechanisms.length > 0 && c.mechanisms.every((m) => m === "human_only");

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function CriteriaEditor({
  initial,
  blocks,
  slug,
  models,
  locked,
}: {
  initial: Criterion[];
  blocks: SchemaBlock[];
  slug: string;
  /** The model each tier runs on right now. */
  models: Record<ModelTier, string>;
  /** Judging has started, so only titles can change. */
  locked: boolean;
}) {
  const { items, edit, dirty, pending, error, justSaved, submit } = useListEditor(
    initial,
    (xs) => saveCriteria(slug, xs),
    snapshot,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const current = items.find((c) => c.id === editing);
  const total = items.reduce((n, c) => n + c.weight, 0);

  const update = (id: string, patch: Partial<Criterion>) =>
    edit((xs) => xs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addCriterion = (at: number) => {
    const id = crypto.randomUUID();
    const criterion: Criterion = {
      id,
      title: "New criterion",
      scale: "score",
      description: "",
      inputs: [],
      mechanisms: ["agent_judge"],
      weight: 0,
      ifMissing: "judge",
      gate: false,
      ...DEFAULT_AGENT_SETTINGS,
      lookFor: [],
    };
    edit((xs) => [...xs.slice(0, at), criterion, ...xs.slice(at)]);
    setEditing(id);
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      <div>
        <PageHeader
          title="Judging Criteria"
          actions={<UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={submit} />}
        />
        <SaveError error={error} />
        {locked && (
          <LockedNote>
            Judging has started, so only criterion titles can change. To change the rest,{" "}
            <TextLink href={`/h/${slug}/judging/progress`}>reset judging</TextLink> first.
          </LockedNote>
        )}

        <SortableList
          items={items}
          onReorder={(next) => edit(() => next)}
          selectedId={editing}
          onSelect={setEditing}
          onInsert={addCriterion}
          addLabel="add criterion"
          locked={locked}
          renderItem={(c, { selected }) => {
            const shade = SHADES[items.indexOf(c) % SHADES.length];
            return (
              <>
                <span className="grid size-8 shrink-0 place-items-center">
                  <span className="size-3 rounded-[2px] bg-accent" style={{ opacity: shade }} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium tracking-wider">{c.title || "Untitled"}</span>
                <span className="hidden items-center gap-1.5 text-muted sm:flex">
                  {c.mechanisms.map((m) => (
                    <PixelIcon key={m} name={mechanismInfo(m).icon} size={12} aria-label={mechanismInfo(m).name} />
                  ))}
                </span>
                {c.scale === "pass_fail" && (
                  <Badge tone={c.gate ? "warning" : "neutral"}>{c.gate ? "gate" : "pass/fail"}</Badge>
                )}
                <Badge tone={selected ? "accent" : "neutral"} className="min-w-12 justify-center">
                  {c.weight}%
                </Badge>
              </>
            );
          }}
        />
      </div>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-36 lg:self-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Total weight</Eyebrow>
            <span className={cn("font-pixel text-xl", total !== 100 && "text-danger")}>{total}%</span>
          </div>
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-[3px] bg-surface-tertiary">
            {items.map((c, i) => (
              <span
                key={c.id}
                title={`${c.title} · ${c.weight}%`}
                className="h-full bg-accent transition-all"
                style={{ width: `${(c.weight / Math.max(total, 100)) * 100}%`, opacity: SHADES[i % SHADES.length] }}
              />
            ))}
          </div>
          {total !== 100 && <span className="text-xs text-danger">Weights should add to 100%</span>}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg leading-none">How it&apos;s used</h2>
          <p className="text-sm text-muted">
            Each criterion is one line on the rubric. Agents score every project against it, and judges see those
            scores next to their own.
          </p>
          <ul className="flex flex-col gap-3 text-sm">
            <ExplainerItem icon="list" title="Inputs">
              Which schema blocks it reads. Leave it on all inputs for criteria about the whole project.
            </ExplainerItem>
            <ExplainerItem icon="spark" title="Mechanisms">
              How the agent checks it: run the repo, watch the video, scrape the demo, or leave it to judges.
            </ExplainerItem>
            <ExplainerItem icon="flag" title="Agent">
              Tell it what to look for and how deep to go. It explains every score, and flags what it isn&apos;t sure
              about for a person.
            </ExplainerItem>
            <ExplainerItem icon="hash" title="Weight">
              Its share of the final score. Weights across all criteria should add to 100%.
            </ExplainerItem>
            <ExplainerItem icon="lock" title="Gates">
              A pass/fail criterion can gate eligibility: failing it rules the project out, whatever else it scores.
            </ExplainerItem>
          </ul>
        </div>
      </aside>

      <EditDrawer
        wide
        isOpen={!!current}
        onClose={() => setEditing(null)}
        eyebrow="Criterion"
        title={current?.title || "Untitled"}
        footer={
          current && (
            <div className="flex w-full items-center justify-between">
<ConfirmButton
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="Remove criterion"
                className="text-muted hover:bg-danger-soft hover:text-danger"
                isDisabled={locked}
                title={`Remove “${current.title || "Untitled"}”?`}
                description="It comes off the rubric once you update, and its weight no longer counts toward the total."
                confirmLabel="Remove criterion"
                onConfirm={() => {
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
          <>
            <Field label="Title">
              <TextInput
                value={current.title}
                maxLength={120}
                onChange={(e) => update(current.id, { title: e.target.value })}
              />
            </Field>
            {locked && <LockedNote>Judging has started, so only the title can change.</LockedNote>}
            <CriterionTabs
              key={current.id}
              criterion={current}
              blocks={blocks}
              models={models}
              locked={locked}
              onChange={(patch) => update(current.id, patch)}
            />
          </>
        )}
      </EditDrawer>
    </div>
  );
}

type CriterionTab = "scoring" | "inputs" | "agent";

/** Everything about a criterion but its title, in tabs: how it's scored, what it reads, how the agent checks it. */
function CriterionTabs({
  criterion: c,
  blocks,
  models,
  locked,
  onChange,
}: {
  criterion: Criterion;
  blocks: SchemaBlock[];
  models: Record<ModelTier, string>;
  locked: boolean;
  onChange: (patch: Partial<Criterion>) => void;
}) {
  const [tab, setTab] = useState<CriterionTab>("scoring");
  const tabs: { id: CriterionTab; label: string; icon: IconName; count?: number }[] = [
    { id: "scoring", label: "Scoring", icon: "hash" },
    { id: "inputs", label: "Inputs", icon: "list", count: c.inputs.length || undefined },
    { id: "agent", label: "Agent", icon: "spark" },
  ];

  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as CriterionTab)} className="w-full">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Criterion settings">
          {tabs.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} className="gap-1.5">
              <PixelIcon name={t.icon} size={12} />
              {t.label}
              {t.count !== undefined && <span className="font-pixel text-xs opacity-70">{t.count}</span>}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {/* Locked once judging starts: reviews already in were scored against all of this. */}
      <Tabs.Panel id="scoring" className="px-0 pt-5">
        <TabFields locked={locked}>
          <ScoringFields criterion={c} onChange={onChange} />
        </TabFields>
      </Tabs.Panel>
      <Tabs.Panel id="inputs" className="px-0 pt-5">
        <TabFields locked={locked}>
          <InputFields criterion={c} blocks={blocks} onChange={onChange} />
        </TabFields>
      </Tabs.Panel>
      <Tabs.Panel id="agent" className="px-0 pt-5">
        <TabFields locked={locked}>
          <AgentFields criterion={c} models={models} onChange={onChange} />
        </TabFields>
      </Tabs.Panel>
    </Tabs>
  );
}

function TabFields({ locked, children }: { locked: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={locked} className="flex min-w-0 flex-col gap-6 disabled:pointer-events-none disabled:opacity-60">
      {children}
    </fieldset>
  );
}

/** How it's scored: scale, weight, the rubric text and whether it gates eligibility. */
function ScoringFields({ criterion: c, onChange }: { criterion: Criterion; onChange: (patch: Partial<Criterion>) => void }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel>Scale</FieldLabel>
          <Segmented
            size="sm"
            value={c.scale}
            onChange={(scale) => onChange({ scale })}
            options={[
              { value: "score", label: "Score 1–10" },
              { value: "pass_fail", label: "Pass / fail" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel>Weight</FieldLabel>
          <Stepper value={c.weight} onChange={(weight) => onChange({ weight })} step={5} suffix="%" />
        </div>
      </div>

      <Field label="Description" hint="the rubric">
        <TextArea
          rows={4}
          maxLength={2000}
          value={c.description}
          placeholder="What does a great project look like here?"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>

      {c.scale === "pass_fail" && (
        <Toggle
          checked={c.gate}
          onChange={(gate) => onChange({ gate })}
          label="Gate eligibility"
          description="Failing this makes the project ineligible, whatever its other scores."
        />
      )}
    </>
  );
}

/** What it reads and how it's checked: schema blocks, missing inputs, mechanisms. */
function InputFields({
  criterion: c,
  blocks,
  onChange,
}: {
  criterion: Criterion;
  blocks: SchemaBlock[];
  onChange: (patch: Partial<Criterion>) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <FieldLabel>Inputs</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={c.inputs.length === 0}
            className="cursor-pointer"
            onClick={() => onChange({ inputs: [] })}
          >
            All inputs
          </Chip>
          {blocks.map((b) => (
            <Chip
              key={b.id}
              icon={blockIcon(b)}
              active={c.inputs.includes(b.id)}
              className="cursor-pointer"
              onClick={() => onChange({ inputs: toggle(c.inputs, b.id) })}
            >
              {b.title}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>If inputs are missing</FieldLabel>
        <Segmented
          size="sm"
          value={c.ifMissing}
          onChange={(ifMissing) => onChange({ ifMissing })}
          options={[
            { value: "judge", label: "Judge what's there" },
            { value: "zero", label: "Score 0" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Mechanisms</FieldLabel>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {mechanisms.map((m) => {
            const on = c.mechanisms.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onChange({ mechanisms: toggle(c.mechanisms, m.id) })}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition",
                  on ? "border-accent bg-accent-soft" : "border-border hover:border-border-secondary",
                )}
              >
                <PixelIcon name={m.icon} size={12} className={on ? "text-accent-soft-foreground" : "text-muted"} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-xs text-muted">{m.does}</span>
                </span>
                {on && <PixelIcon name="check" size={12} className="text-accent-soft-foreground" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** How the agent judges this criterion: what to look for, how hard to look, and when to double-check. */
function AgentFields({
  criterion: c,
  models,
  onChange,
}: {
  criterion: Criterion;
  models: Record<ModelTier, string>;
  onChange: (patch: Partial<Criterion>) => void;
}) {
  if (judgesOnly(c)) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-border-secondary px-3.5 py-3 text-xs text-muted">
        <PixelIcon name="user" size={12} className="mt-0.5 shrink-0" />
        Judges only: the agent skips this criterion, so it has no agent settings.
      </p>
    );
  }
  const tier = MODEL_TIERS.find((t) => t.id === c.agentModel) ?? MODEL_TIERS[1];
  const check = DOUBLE_CHECKS.find((d) => d.id === c.doubleCheck) ?? DOUBLE_CHECKS[1];
  const readsCode = c.mechanisms.includes("code_scraper") || c.mechanisms.includes("sandbox_run");

  return (
    <>
      <Field label="What to look for" hint="the agent follows this">
        <TextArea
          rows={3}
          maxLength={4000}
          value={c.agentGuidance}
          placeholder="e.g. Check the model is really called, not mocked. Tests with no assertions don't count."
          onChange={(e) => onChange({ agentGuidance: e.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <FieldLabel>Model</FieldLabel>
        <Segmented
          size="sm"
          value={c.agentModel}
          onChange={(agentModel) => onChange({ agentModel })}
          options={MODEL_TIERS.map((t) => ({ value: t.id, label: t.label }))}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
        />
        <span className="text-xs text-muted">
          {tier.hint} <span className="font-mono">{modelName(models[c.agentModel])}</span>
        </span>
      </div>

      {readsCode && (
        <div className="flex flex-col gap-2">
          <FieldLabel>Look for in the repo</FieldLabel>
          <TagInput
            label="Look for in the repo"
            values={c.lookFor}
            onChange={(lookFor) => onChange({ lookFor })}
            placeholder="@acme/sdk, acme.generate(, ACME_API_KEY…"
          />
          <span className="text-xs text-muted">
            Packages, imports, API calls or keywords, one per entry. The agent searches the whole repo for each and
            reports where it&apos;s used, not just installed.
          </span>
        </div>
      )}

      {c.mechanisms.includes("sandbox_run") && (
        <Field label="Sandbox commands" hint="optional">
          <TextArea
            rows={3}
            maxLength={2000}
            value={c.sandboxCommands}
            className="font-mono text-sm"
            placeholder={"npm ci\nnpm test"}
            onChange={(e) => onChange({ sandboxCommands: e.target.value })}
          />
          <span className="text-xs text-muted">
            One per line, run in order in a sandbox with the repo cloned. Leave empty and the agent works out
            install, build and test itself.
          </span>
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <FieldLabel>Double-check</FieldLabel>
        <Segmented
          size="sm"
          value={c.doubleCheck}
          onChange={(doubleCheck) => onChange({ doubleCheck })}
          options={DOUBLE_CHECKS.map((d) => ({ value: d.id, label: d.label }))}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
        />
        <span className="text-xs text-muted">{check.hint} Disagreements are flagged for a person.</span>
      </div>
    </>
  );
}
