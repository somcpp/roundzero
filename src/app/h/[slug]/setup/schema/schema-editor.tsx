"use client";

import { useState } from "react";
import { Button, Label, ListBox, Select } from "@heroui/react";
import { BLOCK_TONES, BlockIcon } from "@/components/block-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, TextArea, TextInput, fieldLabelClass } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError, UpdateButton, useListEditor } from "@/components/list-editor";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { SortableList } from "@/components/sortable-list";
import { Badge, Eyebrow, ExplainerItem, PageHeader, TextLink, cn } from "@/components/ui";
import { blockTypes, type BlockType, type SchemaBlock } from "@/lib/data";
import { saveSchemaBlocks } from "@/lib/schema-block-actions";

// The entrant-facing form preview is parked until the public form exists.
const SHOW_PREVIEW = false;

const typeInfo = (t: BlockType) => blockTypes.find((b) => b.type === t) ?? blockTypes[0];
const insertOptions = blockTypes.map((t) => ({ id: t.type, label: t.label, icon: t.icon, tone: BLOCK_TONES[t.type] }));

const snapshot = (bs: SchemaBlock[]) =>
  JSON.stringify(bs.map((b) => [b.id, b.title, b.type, b.description, b.expected]));

export function SchemaEditor({
  initial,
  slug,
  locked,
}: {
  initial: SchemaBlock[];
  slug: string;
  /** Judging has started, so only titles can change. */
  locked: boolean;
}) {
  const { items: blocks, edit, dirty, pending, error, justSaved, submit } = useListEditor(
    initial,
    (items) => saveSchemaBlocks(slug, items),
    snapshot,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const current = blocks.find((b) => b.id === editing);

  const update = (id: string, patch: Partial<SchemaBlock>) =>
    edit((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const addBlock = (type: BlockType, at: number) => {
    const id = crypto.randomUUID();
    const block: SchemaBlock = { id, title: `New ${typeInfo(type).label.toLowerCase()}`, type, description: "", expected: "" };
    edit((bs) => [...bs.slice(0, at), block, ...bs.slice(at)]);
    setEditing(id);
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      <div>
        <PageHeader
          title="Project Schema"
          actions={<UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={submit} />}
        />
        <SaveError error={error} />
        {locked && (
          <LockedNote>
            Judging has started, so only block titles can change. To change the rest,{" "}
            <TextLink href={`/h/${slug}/judging/progress`}>reset judging</TextLink> first.
          </LockedNote>
        )}

        <SortableList
          items={blocks}
          onReorder={(next) => edit(() => next)}
          selectedId={editing}
          onSelect={setEditing}
          onInsert={(at, type) => addBlock((type as BlockType) ?? "text", at)}
          insertOptions={insertOptions}
          addLabel="add block"
          locked={locked}
          renderItem={(b, { selected }) => {
            const info = typeInfo(b.type);
            return (
              <>
                <BlockIcon
                  type={b.type}
                  className="transition-transform group-hover/item:-rotate-6 group-hover/item:scale-110"
                />
                <span className="min-w-0 flex-1 truncate font-medium tracking-wider">{b.title || "Untitled"}</span>
                <Badge tone={selected ? "accent" : "neutral"}>{info.label}</Badge>
              </>
            );
          }}
        />
      </div>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-36 lg:self-start">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg leading-none">How it&apos;s used</h2>
          <p className="text-sm text-muted">
            Each block is one field entrants fill in when they submit a project. The order here is the order on the form.
          </p>
          <ul className="flex flex-col gap-3 text-sm">
            <ExplainerItem icon="paragraph" title="Description">
              Shown to entrants under the field, so they know what to provide.
            </ExplainerItem>
            <ExplainerItem icon="check" title="Expected">
              What a good answer looks like. Entrants see it as guidance, and judging agents use it to check each
              submission.
            </ExplainerItem>
            <ExplainerItem icon="branch" title="Criteria">
              Judging criteria pick which blocks they read, so a repo block can go to a sandbox run and a video
              block to the video reviewer.
            </ExplainerItem>
          </ul>
        </div>

        {SHOW_PREVIEW && (
          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-lg leading-none">Preview form</h2>
            <p className="text-xs text-muted">Entrant-facing, branded</p>
            <FormPreview blocks={blocks} />
          </div>
        )}
      </aside>

      <EditDrawer
        isOpen={!!current}
        onClose={() => setEditing(null)}
        eyebrow="Block"
        title={current?.title || "Untitled"}
        footer={
          current && (
            <div className="flex w-full items-center justify-between">
<ConfirmButton
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label="Remove block"
                className="text-muted hover:bg-danger-soft hover:text-danger"
                isDisabled={locked}
                title={`Remove “${current.title || "Untitled"}”?`}
                description="Entrants won't see this field, and criteria that read it will stop using it once you update."
                confirmLabel="Remove block"
                onConfirm={() => {
                  edit((bs) => bs.filter((x) => x.id !== current.id));
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
            <div className="flex gap-4">
              <Field label="Title" className="min-w-0 flex-1">
                <TextInput
                  value={current.title}
                  maxLength={120}
                  onChange={(e) => update(current.id, { title: e.target.value })}
                />
              </Field>
              <TypeSelect
                value={current.type}
                isDisabled={locked}
                onChange={(type) => update(current.id, { type })}
              />
            </div>
            {locked && <LockedNote>Judging has started, so only the title can change.</LockedNote>}
            {/* Locked once judging starts: projects were submitted, and agents check them, against these. */}
            <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5 disabled:pointer-events-none disabled:opacity-60">
              <Field label="Description" hint="shown to entrants">
                <TextArea
                  rows={3}
                  maxLength={2000}
                  value={current.description}
                  onChange={(e) => update(current.id, { description: e.target.value })}
                />
              </Field>
              <Field label="Expected" hint="guides entrants + agents">
                <TextArea
                  rows={3}
                  maxLength={2000}
                  value={current.expected}
                  onChange={(e) => update(current.id, { expected: e.target.value })}
                />
              </Field>
            </fieldset>
          </>
        )}
      </EditDrawer>
    </div>
  );
}

function TypeSelect({
  value,
  isDisabled,
  onChange,
}: {
  value: BlockType;
  isDisabled: boolean;
  onChange: (type: BlockType) => void;
}) {
  return (
    <Select
      value={value}
      isDisabled={isDisabled}
      onChange={(key) => key && onChange(key as BlockType)}
      className="flex w-40 shrink-0 grow-0 flex-col gap-2"
    >
      <Label className={fieldLabelClass}>Type</Label>
      <Select.Trigger className="min-h-11 gap-2 rounded-lg border-2 border-border bg-surface px-3.5 hover:border-border-strong data-[disabled]:opacity-60 data-[focus-visible]:border-accent">
        <Select.Value>
          {({ selectedText }) => {
            const info = typeInfo(value);
            return (
              <span className="flex items-center gap-2.5 text-[15px]">
                <BlockIcon type={value} size="sm" />
                {selectedText || info.label}
              </span>
            );
          }}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-44">
        <ListBox>
          {blockTypes.map((t) => (
            <ListBox.Item key={t.type} id={t.type} textValue={t.label}>
              <BlockIcon type={t.type} size="sm" />
              {t.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function FormPreview({ blocks }: { blocks: SchemaBlock[] }) {
  return (
    <div className="dither rounded-lg border border-border p-3">
      <div className="flex flex-col gap-2.5 rounded-md bg-surface p-4 shadow-sm">
        <Eyebrow className="text-accent">Submit your project</Eyebrow>
        {blocks.slice(0, 5).map((b) => (
          <div key={b.id} className="flex flex-col gap-1">
            <span className="text-[10px] text-muted">{b.title}</span>
            <span className={cn("rounded-[3px] border border-border", b.type === "long text" ? "h-8" : "h-4")} />
          </div>
        ))}
        {blocks.length > 5 && <span className="text-[10px] text-muted">+ {blocks.length - 5} more</span>}
        <span className="mt-1 h-5 w-16 rounded-[3px] bg-accent" />
      </div>
    </div>
  );
}
