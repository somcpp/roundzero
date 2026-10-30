"use client";

import { useState } from "react";
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
} from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FieldLabel, Segmented, Stepper, TextInput } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError, UpdateButton, useListEditor } from "@/components/list-editor";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { SortableList } from "@/components/sortable-list";
import { Badge, Chip, Eyebrow, ExplainerItem, PageHeader, TextLink, cn } from "@/components/ui";
import { foregroundFor } from "@/lib/branding";
import type { JudgeGroup, JudgingPhase } from "@/lib/data";
import { savePhases } from "@/lib/judging-actions";
import { PHASE_SWATCHES, defaultPhaseColor, phaseColor } from "@/lib/phase-colors";

const snapshot = (ps: JudgingPhase[]) =>
  JSON.stringify(
    ps.map((p, i) => [p.id, p.name, p.judgeGroupId, p.reviewsPerProject, i === ps.length - 1 ? null : p.advanceCount, p.color]),
  );

export function PhasesEditor({
  initial,
  groups,
  judgeCount,
  projectCount,
  locked,
  slug,
}: {
  initial: JudgingPhase[];
  groups: JudgeGroup[];
  judgeCount: number;
  projectCount: number;
  /** Judging has started, so only names can change. */
  locked: boolean;
  slug: string;
}) {
  const { items, edit, dirty, pending, error, justSaved, submit } = useListEditor(
    initial,
    (xs) => savePhases(slug, xs),
    snapshot,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const current = items.find((p) => p.id === editing);
  const currentIdx = current ? items.indexOf(current) : -1;

  const update = (id: string, patch: Partial<JudgingPhase>) =>
    edit((xs) => xs.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPhase = (at: number) => {
    const id = crypto.randomUUID();
    const before = items[at - 1];
    const phase: JudgingPhase = {
      id,
      name: "New phase",
      judgeGroupId: null,
      reviewsPerProject: 3,
      advanceCount: Math.max(1, Math.floor((before?.advanceCount ?? 10) / 2)),
      startedAt: null,
      closedAt: null,
      color: null,
    };
    edit((xs) => [...xs.slice(0, at), phase, ...xs.slice(at)]);
    setEditing(id);
  };

  // Projects entering each phase: everything still in the running, then
  // whatever the phase before advanced (never more than came into it). With no
  // projects yet, show the planned caps instead.
  const incoming: (number | null)[] = [];
  items.forEach((_, i) => {
    const cap = i === 0 ? projectCount : items[i - 1].advanceCount;
    const prev = incoming[i - 1];
    incoming.push(i === 0 || projectCount === 0 || cap === null || prev === null ? cap : Math.min(prev, cap));
  });
  const funnelMax = Math.max(projectCount, ...incoming.map((n) => n ?? 0), 1);
  const poolSize = (p: JudgingPhase) =>
    p.judgeGroupId ? (groups.find((g) => g.id === p.judgeGroupId)?.members.length ?? 0) : judgeCount;
  const groupName = (p: JudgingPhase) =>
    p.judgeGroupId ? (groups.find((g) => g.id === p.judgeGroupId)?.name ?? "All judges") : "All judges";

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      <div>
        <PageHeader
          title="Judging Phases"
          actions={<UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={submit} />}
        />
        <SaveError error={error} />
        {locked && (
          <LockedNote>
            Judging has started, so only phase names and colors can change. To change the rest,{" "}
            <TextLink href={`/h/${slug}/judging/progress`}>reset judging</TextLink> first.
          </LockedNote>
        )}

        <SortableList
          items={items}
          onReorder={(next) => edit(() => next)}
          selectedId={editing}
          onSelect={setEditing}
          onInsert={addPhase}
          addLabel="add phase"
          locked={locked}
          renderItem={(p, { selected }) => {
            const i = items.indexOf(p);
            const last = i === items.length - 1;
            return (
              <>
                {/* Numbered in the phase's funnel color. */}
                <span
                  className="lip grid size-8 shrink-0 place-items-center rounded-md font-pixel text-sm"
                  style={{ background: phaseColor(p, i, items.length), color: foregroundFor(phaseColor(p, i, items.length)) }}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium tracking-wider">{p.name || "Untitled"}</span>
                  <span className="truncate text-sm text-muted">
                    {groupName(p)} ·{" "}
                    {p.reviewsPerProject ? `${p.reviewsPerProject} per project` : "everyone reviews all"}
                  </span>
                </span>
                {p.startedAt && (
                  <Badge tone={p.closedAt ? "neutral" : "accent"} dot={!p.closedAt}>
                    {p.closedAt ? "closed" : "running"}
                  </Badge>
                )}
                {last ? (
                  <Badge tone={selected ? "accent" : "success"}>
                    <PixelIcon name="trophy" size={10} /> winners
                  </Badge>
                ) : p.advanceCount ? (
                  <Badge tone={selected ? "accent" : "neutral"}>top {p.advanceCount}</Badge>
                ) : (
                  <Badge tone="danger">set advance</Badge>
                )}
              </>
            );
          }}
        />
      </div>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-36 lg:self-start">
        <div className="flex flex-col gap-3">
          <Eyebrow>Funnel</Eyebrow>
          <ol className="flex flex-col gap-1.5 text-sm">
            <FunnelRow label="Projects" count={projectCount} max={funnelMax} muted />
            {items.map((p, i) => (
              <FunnelRow
                key={p.id}
                label={p.name || "Untitled"}
                count={projectCount ? incoming[i] : null}
                // No projects yet: show what each phase takes in, in words.
                caption={i === 0 ? "all" : incoming[i] !== null ? `top ${incoming[i]}` : "–"}
                max={funnelMax}
                color={phaseColor(p, i, items.length)}
              />
            ))}
          </ol>
          {projectCount === 0 && <p className="text-xs text-muted">Counts fill in once projects are added.</p>}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg leading-none">How it&apos;s used</h2>
          <p className="text-sm text-muted">
            Judging runs through these phases top to bottom. Each one reviews what the last one passed on, so the pool
            shrinks until the final phase picks the winners.
          </p>
          <ul className="flex flex-col gap-3 text-sm">
            <ExplainerItem icon="users" title="Judges">
              Everyone, or one saved group from Setup › Judges, like a final panel.
            </ExplainerItem>
            <ExplainerItem icon="hash" title="Reviews per project">
              How many judges see each project. &ldquo;Everyone&rdquo; suits a small final panel.
            </ExplainerItem>
            <ExplainerItem icon="arrow-down" title="Advance">
              How many top-scoring projects go on to the next phase.
            </ExplainerItem>
          </ul>
        </div>
      </aside>

      <EditDrawer
        isOpen={!!current}
        onClose={() => setEditing(null)}
        eyebrow={current ? `Phase ${currentIdx + 1} of ${items.length}` : "Phase"}
        title={current?.name || "Untitled"}
        footer={
          current && (
            <div className="flex w-full items-center justify-between">
              <ConfirmButton
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="Remove phase"
                className="text-muted hover:bg-danger-soft hover:text-danger"
                isDisabled={locked || items.length === 1 || !!current.startedAt}
                title={`Remove “${current.name || "Untitled"}”?`}
                description="Projects in this phase drop back to no phase once you update. Their audit trail is kept."
                confirmLabel="Remove phase"
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
          <PhaseFields
            phase={current}
            last={currentIdx === items.length - 1}
            defaultColor={defaultPhaseColor(currentIdx, items.length)}
            next={items[currentIdx + 1]}
            incoming={incoming[currentIdx]}
            pool={poolSize(current)}
            groups={groups}
            locked={locked}
            onChange={(patch) => update(current.id, patch)}
          />
        )}
      </EditDrawer>
    </div>
  );
}

function PhaseFields({
  phase: p,
  last,
  defaultColor,
  next,
  incoming,
  pool,
  groups,
  locked,
  onChange,
}: {
  phase: JudgingPhase;
  last: boolean;
  /** What the funnel uses while no color is picked. */
  defaultColor: string;
  next?: JudgingPhase;
  incoming: number | null;
  pool: number;
  groups: JudgeGroup[];
  locked: boolean;
  onChange: (patch: Partial<JudgingPhase>) => void;
}) {
  const reviews = p.reviewsPerProject ?? pool;
  const load = incoming && pool ? Math.ceil((incoming * Math.min(reviews, pool)) / pool) : null;

  return (
    <>
      <Field label="Name">
        <TextInput value={p.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>

      <PhaseColor color={p.color} defaultColor={defaultColor} onChange={(color) => onChange({ color })} />

      {locked && <LockedNote>Judging has started, so only the name and color can change.</LockedNote>}

      {/* Locked once judging starts: these decided the assignments already handed out. */}
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5 disabled:pointer-events-none disabled:opacity-60">
        <div className="flex flex-col gap-2">
          <FieldLabel>Judges</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Chip active={p.judgeGroupId === null} icon="users" onClick={() => onChange({ judgeGroupId: null })}>
              All judges
            </Chip>
            {groups.map((g) => (
              <Chip key={g.id} active={p.judgeGroupId === g.id} icon="tag" onClick={() => onChange({ judgeGroupId: g.id })}>
                {g.name}
                <span className="font-pixel text-xs opacity-70">{g.members.length}</span>
              </Chip>
            ))}
          </div>
          {groups.length === 0 && (
            <span className="text-xs text-muted">Save a group in Setup › Judges to hand a phase to a panel.</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Reviews per project</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              size="sm"
              value={p.reviewsPerProject === null ? "all" : "set"}
              onChange={(v) => onChange({ reviewsPerProject: v === "all" ? null : 2 })}
              options={[
                { value: "set", label: "Set number" },
                { value: "all", label: "Everyone reviews all" },
              ]}
            />
            {p.reviewsPerProject !== null && (
              <Stepper value={p.reviewsPerProject} onChange={(v) => onChange({ reviewsPerProject: v })} min={1} max={20} />
            )}
          </div>
          {p.reviewsPerProject !== null && pool > 0 && p.reviewsPerProject > pool && (
            <span className="text-xs text-warning-soft-foreground">
              Only {pool} {pool === 1 ? "judge" : "judges"} in this pool, so each project gets {pool}.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Advance</FieldLabel>
          {last ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <PixelIcon name="trophy" size={12} /> The last phase picks the winners, so nothing advances from it.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm">
                <span>Top</span>
                <span className="w-24 shrink-0">
                  <TextInput
                    type="number"
                    min={1}
                    max={10000}
                    aria-label="Projects that advance"
                    value={p.advanceCount ?? ""}
                    onChange={(e) => onChange({ advanceCount: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </span>
                <span className="text-muted">go on to {next?.name || "the next phase"}</span>
              </div>
              {incoming !== null && p.advanceCount !== null && p.advanceCount >= incoming && incoming > 0 && (
                <span className="text-xs text-warning-soft-foreground">
                  Only {incoming} {incoming === 1 ? "project comes" : "come"} into this phase, so it wouldn&apos;t narrow
                  anything.
                </span>
              )}
            </>
          )}
        </div>
      </fieldset>

      <div className="rounded-lg bg-surface-secondary/60 px-4 py-3 text-sm">
        {incoming && pool ? (
          <>
            <b className="font-pixel">{incoming}</b> projects × {Math.min(reviews, pool)} ÷ {pool} judges ≈{" "}
            <b className="font-pixel text-accent">{load}</b> each
          </>
        ) : (
          <span className="text-muted">
            {pool === 0 ? "No judges in this pool yet." : "The per-judge load shows once projects are in."}
          </span>
        )}
      </div>
    </>
  );
}

function FunnelRow({
  label,
  count,
  caption,
  max,
  muted,
  color,
}: {
  label: string;
  count: number | null;
  caption?: string;
  max: number;
  muted?: boolean;
  color?: string;
}) {
  const pct = count ? Math.max(4, Math.min(100, (count / max) * 100)) : 0;
  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className={cn("truncate", muted && "text-muted")}>{label}</span>
        <span className="font-pixel text-xs">{count ?? caption ?? "–"}</span>
      </span>
      <span className="h-2 rounded-[2px] bg-surface-tertiary">
        <span
          className={cn("block h-full rounded-[2px] transition-all", muted ? "bg-foreground/30" : "bg-accent")}
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
    </li>
  );
}

/** The phase's color on the progress funnel: presets, a full picker, or back to the default. */
function PhaseColor({
  color,
  defaultColor,
  onChange,
}: {
  color: string | null;
  defaultColor: string;
  onChange: (color: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Color</FieldLabel>
      <div className="flex items-center gap-3">
        <ColorPicker value={color ?? defaultColor} onChange={(c) => onChange(c.toString("hex").toLowerCase())}>
          <ColorPicker.Trigger>
            <ColorSwatch size="lg" />
            <Label className={cn("text-sm", color && "font-mono")}>{color ?? "Default"}</Label>
          </ColorPicker.Trigger>
          <ColorPicker.Popover className="gap-2">
            <ColorSwatchPicker aria-label="Preset colors" className="justify-center pt-2" size="xs">
              {PHASE_SWATCHES.map((hex) => (
                <ColorSwatchPicker.Item key={hex} color={hex}>
                  <ColorSwatchPicker.Swatch />
                  <ColorSwatchPicker.Indicator />
                </ColorSwatchPicker.Item>
              ))}
            </ColorSwatchPicker>
            <ColorArea aria-label="Saturation and brightness" className="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
              <ColorArea.Thumb />
            </ColorArea>
            <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
              <Label>Hue</Label>
              <ColorSlider.Output className="text-muted" />
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
            <ColorField aria-label="Hex value">
              <ColorField.Group variant="secondary">
                <ColorField.Prefix>
                  <ColorSwatch size="xs" />
                </ColorField.Prefix>
                <ColorField.Input />
              </ColorField.Group>
            </ColorField>
          </ColorPicker.Popover>
        </ColorPicker>
        {color && (
          <Button size="sm" variant="ghost" onPress={() => onChange(null)}>
            Use default
          </Button>
        )}
      </div>
      <span className="text-xs text-muted">Shown on the progress funnel.</span>
    </div>
  );
}
