"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { ConfirmButton, ConfirmDialog } from "@/components/confirm-button";
import { Field, FieldLabel, TextInput } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError } from "@/components/list-editor";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { Chip, cn } from "@/components/ui";
import type { JudgeDirectory, JudgeField, JudgeGroup, JudgeProfile } from "@/lib/data";
import { JudgeLinkField } from "@/components/judge-link";
import { deleteJudge, regenerateJudgeLink, saveJudge, type NewFieldOption } from "@/lib/judge-actions";
import { discardJudgeImage, uploadJudgeImage } from "@/lib/judge-images";
import { JudgePhoto } from "./judge-photo";
import { NewOptionChip } from "./new-option-chip";

export type JudgeDraft = JudgeProfile & { groups: string[] };

const snapshot = (j: JudgeDraft) =>
  JSON.stringify([j.name.trim(), j.title.trim(), j.email.trim(), j.imagePath, Object.entries(j.values).sort(), [...j.groups].sort()]);

/** A field's saved options plus any typed in on this form (and not saved yet). */
const withNew = (f: JudgeField, added: NewFieldOption[]) => [
  ...f.options,
  ...added.filter((o) => o.fieldId === f.id && !f.options.some((x) => x.id === o.id)),
];

/** Drawer to add or edit one judge. Stays mounted; `target` null closes it. */
export function JudgeDrawer({
  target,
  isNew,
  fields,
  groups,
  hackathonId,
  slug,
  reviewed,
  onClose,
  onSaved,
}: {
  target: JudgeDraft | null;
  isNew: boolean;
  fields: JudgeField[];
  groups: JudgeGroup[];
  hackathonId: string;
  slug: string;
  /** Judges with reviews in judging, who can't be deleted: it would delete their reviews too. */
  reviewed: string[];
  onClose: () => void;
  onSaved: (directory: JudgeDirectory) => void;
}) {
  // Reset the form whenever a different judge opens. Keep the last draft while
  // closing so the drawer doesn't empty out mid-animation.
  const [openFor, setOpenFor] = useState(target);
  const [draft, setDraft] = useState(target);
  const [newOptions, setNewOptions] = useState<NewFieldOption[]>([]);
  const [error, setError] = useState<string>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Their link after "New link", until the drawer opens someone else.
  const [newToken, setNewToken] = useState<string>();
  if (target !== openFor) {
    setOpenFor(target);
    if (target) {
      setDraft(target);
      setNewOptions([]);
      setError(undefined);
      setNewToken(undefined);
    }
  }
  const linkToken = newToken ?? target?.accessToken;

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const readOnly = useReadOnly();

  const original = target;
  const dirty = !!original && !!draft && snapshot(draft) !== snapshot(original);
  const deleteLocked = !!draft && reviewed.includes(draft.id);
  const freshUpload = draft?.imagePath && draft.imagePath !== original?.imagePath ? draft.imagePath : null;
  const set = (patch: Partial<JudgeDraft>) => setDraft((d) => d && { ...d, ...patch });

  const close = () => {
    if (freshUpload) void discardJudgeImage(freshUpload);
    setConfirmDiscard(false);
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmDiscard(true) : close());

  const upload = async (file: File | undefined) => {
    if (!file || !draft) return;
    setUploading(true);
    setError(undefined);
    const result = await uploadJudgeImage(hackathonId, draft.id, file);
    setUploading(false);
    if ("error" in result) return setError(result.error);
    // Replacing a photo that was never saved: drop it from the bucket now.
    if (freshUpload) void discardJudgeImage(freshUpload);
    set({ imagePath: result.path });
  };

  const removePhoto = () => {
    if (freshUpload) void discardJudgeImage(freshUpload);
    set({ imagePath: null });
  };

  const save = () =>
    startTransition(async () => {
      if (!draft) return;
      setError(undefined);
      // Only create typed-in options the judge actually ended up with.
      const used = newOptions.filter((o) => draft.values[o.fieldId] === o.id);
      const result = await saveJudge(slug, draft, used);
      if ("error" in result) return setError(result.error);
      onSaved(result.directory);
      onClose();
    });

  const addOption = (field: JudgeField, label: string) => {
    if (!draft) return;
    const existing = withNew(field, newOptions).find((o) => o.label.toLowerCase() === label.toLowerCase());
    const id = existing?.id ?? crypto.randomUUID();
    if (!existing) setNewOptions((os) => [...os, { fieldId: field.id, id, label }]);
    set({ values: { ...draft.values, [field.id]: id } });
  };

  const pickOption = (fieldId: string, optionId: string) => {
    if (!draft) return;
    const values = { ...draft.values };
    if (values[fieldId] === optionId) delete values[fieldId];
    else values[fieldId] = optionId;
    set({ values });
  };

  return (
    <>
      <EditDrawer
        isOpen={!!target}
        onClose={requestClose}
        eyebrow={isNew ? "New judge" : "Judge"}
        title={draft?.name.trim() || "Untitled judge"}
        footer={
          draft && (
            <div className="flex w-full items-center gap-2">
              {!isNew && (
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  aria-label="Delete judge"
                  className="text-muted hover:bg-danger-soft hover:text-danger"
                  isDisabled={deleteLocked}
                  title={`Delete ${original?.name || "this judge"}?`}
                  description="They're removed from every group, and their photo is deleted. This can't be undone."
                  confirmLabel="Delete judge"
                  pendingLabel="Deleting…"
                  onConfirm={async () => {
                    const result = await deleteJudge(slug, draft.id);
                    if ("error" in result) return result.error;
                    if (freshUpload) void discardJudgeImage(freshUpload);
                    onSaved(result.directory);
                    onClose();
                  }}
                >
                  <PixelIcon name="trash" size={14} />
                </ConfirmButton>
              )}
              <span className="ml-auto text-sm text-muted" aria-live="polite">
                {dirty && !pending ? (readOnly ? "Demo: changes aren't saved" : "Unsaved changes") : ""}
              </span>
              <Button variant="tertiary" onPress={requestClose}>
                Cancel
              </Button>
              <Button onPress={save} isDisabled={readOnly || pending || uploading || !draft.name.trim() || (!dirty && !isNew)}>
                {pending ? "Saving…" : isNew ? "Add judge" : "Save"}
              </Button>
            </div>
          )
        }
      >
        {draft && (
          <>
            <SaveError error={error} />

            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label={draft.imagePath ? "Replace photo" : "Upload photo"}
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
                <JudgePhoto name={draft.name} imagePath={draft.imagePath} size={80} className="rounded-lg" />
                {uploading && (
                  <span className="absolute inset-0 grid place-items-center rounded-lg bg-background/70 font-pixel text-xs">
                    …
                  </span>
                )}
              </button>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" isDisabled={readOnly || uploading} onPress={() => fileInput.current?.click()}>
                    <PixelIcon name="image" size={12} />
                    {uploading ? "Uploading…" : draft.imagePath ? "Replace" : "Upload photo"}
                  </Button>
                  {draft.imagePath && (
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      title="Remove this photo?"
                      description="They'll show their pixel avatar instead once you save."
                      confirmLabel="Remove photo"
                      onConfirm={removePhoto}
                    >
                      Remove
                    </ConfirmButton>
                  )}
                </div>
                <span className="text-xs text-muted">Drop an image or click. Square headshots look best.</span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <Field label="Name">
              <TextInput
                value={draft.name}
                maxLength={120}
                autoFocus={isNew}
                placeholder="Ada Lovelace"
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field label="Title">
              <TextInput
                value={draft.title}
                maxLength={160}
                placeholder="Head of Developer Relations"
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
            <Field label="Email" hint="for their judging link">
              <TextInput
                type="email"
                value={draft.email}
                maxLength={254}
                placeholder="ada@example.com"
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>

            {!isNew && linkToken && (
              <div className="flex flex-col gap-2">
                <span className="flex items-center justify-between gap-2">
                  <FieldLabel>Judging link</FieldLabel>
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    title={`Make a new link for ${original?.name || "this judge"}?`}
                    description="Their current link stops working straight away. Send them the new one."
                    confirmLabel="Make new link"
                    pendingLabel="Making…"
                    onConfirm={async () => {
                      const result = await regenerateJudgeLink(slug, draft.id);
                      if ("error" in result) return result.error;
                      setNewToken(result.directory.judges.find((j) => j.id === draft.id)?.accessToken);
                      onSaved(result.directory);
                    }}
                  >
                    New link
                  </ConfirmButton>
                </span>
                <JudgeLinkField token={linkToken} name={draft.name || "this judge"} />
                <span className="text-xs text-muted">
                  Their private page to score their queue. Anyone with the link can score as them, so send it directly.
                </span>
              </div>
            )}

            {fields.map((f) => {
              const options = withNew(f, newOptions);
              return (
                <div key={f.id} className="flex flex-col gap-2">
                  <FieldLabel>{f.name}</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {options.map((o) => (
                      <Chip key={o.id} active={draft.values[f.id] === o.id} onClick={() => pickOption(f.id, o.id)}>
                        {o.label}
                      </Chip>
                    ))}
                    <NewOptionChip label={`New ${f.name.toLowerCase()}`} onAdd={(label) => addOption(f, label)} />
                  </div>
                </div>
              );
            })}

            {groups.length > 0 && (
              <div className="flex flex-col gap-2">
                <FieldLabel>Groups</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const on = draft.groups.includes(g.id);
                    return (
                      <Chip
                        key={g.id}
                        active={on}
                        icon={on ? "check" : "users"}
                        onClick={() => set({ groups: on ? draft.groups.filter((x) => x !== g.id) : [...draft.groups, g.id] })}
                      >
                        {g.name}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}

            {fields.length === 0 && (
              <p className="text-sm text-muted">
                Add custom fields like Company or Track from the sidebar to filter and group judges.
              </p>
            )}

            {deleteLocked && !isNew && (
              <LockedNote>
                Judging has started and {original?.name || "this judge"} has reviews, so they can&apos;t be deleted.
              </LockedNote>
            )}
          </>
        )}
      </EditDrawer>

      <ConfirmDialog
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={close}
        title="Discard changes?"
        description={isNew ? "This judge hasn't been added yet." : "Your edits to this judge haven't been saved."}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
      />
    </>
  );
}
