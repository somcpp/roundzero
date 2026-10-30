"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { ConfirmButton, ConfirmDialog } from "@/components/confirm-button";
import { Field, FieldLabel, TextInput } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError } from "@/components/list-editor";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { Badge, Chip, cn } from "@/components/ui";
import type { JudgeDirectory, JudgeField, JudgeGroup, JudgeProfile } from "@/lib/data";
import { deleteJudgeGroup, saveJudgeGroup } from "@/lib/judge-actions";
import { JudgePhoto } from "./judge-photo";

const snapshot = (g: JudgeGroup) => JSON.stringify([g.name.trim(), [...g.members].sort()]);

/** Drawer to create or edit a saved group: a name and a checklist of judges. */
export function GroupDrawer({
  target,
  isNew,
  judges,
  fields,
  slug,
  inUse,
  onClose,
  onSaved,
}: {
  target: JudgeGroup | null;
  isNew: boolean;
  judges: JudgeProfile[];
  fields: JudgeField[];
  slug: string;
  /** Groups a phase uses once judging has started. They can't be deleted: the phase would go to all judges. */
  inUse: string[];
  onClose: () => void;
  onSaved: (directory: JudgeDirectory, groupId: string | null) => void;
}) {
  const [openFor, setOpenFor] = useState(target);
  const [draft, setDraft] = useState(target);
  const [query, setQuery] = useState("");
  // Field id → picked option ids. Options within a field are OR'd, fields AND'd.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const readOnly = useReadOnly();
  if (target !== openFor) {
    setOpenFor(target);
    if (target) {
      setDraft(target);
      setQuery("");
      setPicked({});
      setError(undefined);
    }
  }

  const dirty = !!target && !!draft && snapshot(draft) !== snapshot(target);
  const deleteLocked = !!draft && inUse.includes(draft.id);
  const close = () => {
    setConfirmDiscard(false);
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmDiscard(true) : close());

  const save = () =>
    startTransition(async () => {
      if (!draft) return;
      setError(undefined);
      const result = await saveJudgeGroup(slug, draft);
      if ("error" in result) return setError(result.error);
      onSaved(result.directory, draft.id);
      onClose();
    });

  const q = query.trim().toLowerCase();
  const optionLabel = (f: JudgeField, id: string | undefined) => f.options.find((o) => o.id === id)?.label;
  const activePicks = fields.filter((f) => picked[f.id]?.length);
  const filtering = !!q || activePicks.length > 0;
  const shown = judges.filter((j) => {
    for (const f of activePicks) if (!picked[f.id].includes(j.values[f.id])) return false;
    if (!q) return true;
    const haystack = [j.name, j.title, j.email, ...fields.map((f) => optionLabel(f, j.values[f.id]) ?? "")];
    return haystack.join(" ").toLowerCase().includes(q);
  });
  const togglePick = (fieldId: string, optionId: string) =>
    setPicked((p) => {
      const cur = p[fieldId] ?? [];
      return { ...p, [fieldId]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
    });
  const members = new Set(draft?.members);
  const allShownIn = shown.length > 0 && shown.every((j) => members.has(j.id));

  const setMembers = (ids: string[], on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const next = new Set(d.members);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return { ...d, members: [...next] };
    });

  return (
    <>
      <EditDrawer
        isOpen={!!target}
        onClose={requestClose}
        eyebrow={isNew ? "New group" : "Group"}
        title={draft?.name.trim() || "Untitled group"}
        footer={
          draft && (
            <div className="flex w-full items-center gap-2">
              {!isNew && (
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  aria-label="Delete group"
                  className="text-muted hover:bg-danger-soft hover:text-danger"
                  isDisabled={deleteLocked}
                  title={`Delete “${target?.name}”?`}
                  description="The group goes away; its judges stay."
                  confirmLabel="Delete group"
                  pendingLabel="Deleting…"
                  onConfirm={async () => {
                    const result = await deleteJudgeGroup(slug, draft.id);
                    if ("error" in result) return result.error;
                    onSaved(result.directory, null);
                    onClose();
                  }}
                >
                  <PixelIcon name="trash" size={14} />
                </ConfirmButton>
              )}
              <span className="ml-auto font-pixel text-xs text-muted">{draft.members.length} judges</span>
              <Button variant="tertiary" onPress={requestClose}>
                Cancel
              </Button>
              <Button onPress={save} isDisabled={readOnly || pending || !draft.name.trim() || (!dirty && !isNew)}>
                {pending ? "Saving…" : isNew ? "Create group" : "Save"}
              </Button>
            </div>
          )
        }
      >
        {draft && (
          <>
            <SaveError error={error} />
            <Field label="Name">
              <TextInput
                value={draft.name}
                maxLength={60}
                autoFocus={isNew}
                placeholder="Final panel"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <FieldLabel>Judges</FieldLabel>
                {shown.length > 0 && (
                  <button
                    type="button"
                    className="text-sm text-muted underline decoration-border-secondary underline-offset-4 hover:text-foreground"
                    onClick={() => setMembers(shown.map((j) => j.id), !allShownIn)}
                  >
                    {allShownIn ? "Clear" : "Select"} {filtering ? `${shown.length} matching` : "all"}
                  </button>
                )}
              </div>
              {judges.length > 0 && (
                <TextInput
                  type="search"
                  value={query}
                  placeholder="Search judges…"
                  aria-label="Search judges"
                  className="min-h-9 py-1.5 text-sm"
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
              {judges.length > 0 &&
                fields
                  .filter((f) => f.options.length > 0)
                  .map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-sm font-medium text-muted">{f.name}</span>
                      {f.options.map((o) => {
                        const count = judges.filter((j) => j.values[f.id] === o.id).length;
                        return (
                          <Chip
                            key={o.id}
                            active={picked[f.id]?.includes(o.id)}
                            className={cn("px-2.5 py-0.5 text-xs", !count && "opacity-50")}
                            onClick={() => togglePick(f.id, o.id)}
                          >
                            {o.label}
                            <span className="font-pixel opacity-70">{count}</span>
                          </Chip>
                        );
                      })}
                    </div>
                  ))}
              {filtering && (
                <button
                  type="button"
                  className="self-start text-sm text-muted underline decoration-border-secondary underline-offset-4 hover:text-foreground"
                  onClick={() => {
                    setQuery("");
                    setPicked({});
                  }}
                >
                  Clear filters
                </button>
              )}
              {judges.length === 0 ? (
                <p className="text-sm text-muted">Add some judges first, then group them here.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border-2 border-border">
                  {shown.map((j) => {
                    const on = members.has(j.id);
                    return (
                      <li key={j.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => setMembers([j.id], !on)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left transition",
                            on ? "bg-accent-soft" : "hover:bg-surface-secondary",
                          )}
                        >
                          <JudgePhoto name={j.name} imagePath={j.imagePath} size={28} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{j.name}</span>
                            {j.title && <span className="truncate text-xs text-muted">{j.title}</span>}
                          </span>
                          <span className="hidden shrink-0 gap-1 sm:flex">
                            {fields.map((f) => {
                              const label = optionLabel(f, j.values[f.id]);
                              return label && <Badge key={f.id}>{label}</Badge>;
                            })}
                          </span>
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-[5px] border-2",
                              on ? "border-accent bg-accent text-accent-foreground" : "border-border-strong",
                            )}
                          >
                            {on && <PixelIcon name="check" size={10} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">No judges match.</li>}
                </ul>
              )}
            </div>

            {deleteLocked && !isNew && (
              <LockedNote>Judging has started and a phase uses this group, so it can&apos;t be deleted.</LockedNote>
            )}
          </>
        )}
      </EditDrawer>

      <ConfirmDialog
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={close}
        title="Discard changes?"
        description={isNew ? "This group hasn't been created yet." : "Your edits to this group haven't been saved."}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
      />
    </>
  );
}
