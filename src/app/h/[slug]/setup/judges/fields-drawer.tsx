"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { ConfirmButton, ConfirmDialog } from "@/components/confirm-button";
import { Field, FieldLabel, TextInput, inputClass } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { AddTile, cn } from "@/components/ui";
import type { JudgeDirectory, JudgeField, JudgeProfile } from "@/lib/data";
import { saveJudgeFields } from "@/lib/judge-actions";
import { NewOptionChip } from "./new-option-chip";

const snapshot = (fs: JudgeField[]) =>
  JSON.stringify(fs.map((f) => [f.id, f.name.trim(), f.options.map((o) => [o.id, o.label.trim()])]));

const blankField = (): JudgeField => ({ id: crypto.randomUUID(), name: "", options: [] });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Drawer to manage the hackathon's custom judge fields and their options. */
export function FieldsDrawer({
  isOpen,
  fields,
  judges,
  slug,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  fields: JudgeField[];
  judges: JudgeProfile[];
  slug: string;
  onClose: () => void;
  onSaved: (directory: JudgeDirectory) => void;
}) {
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [draft, setDraft] = useState(fields);
  const [error, setError] = useState<string>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const readOnly = useReadOnly();
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      // Nothing to manage yet: start with a blank field to fill in.
      setDraft(fields.length ? fields : [blankField()]);
      setError(undefined);
    }
  }

  const dirty = isOpen && snapshot(draft) !== snapshot(fields);
  const usage = (fieldId: string, optionId?: string) =>
    judges.filter((j) => (optionId ? j.values[fieldId] === optionId : fieldId in j.values)).length;

  const update = (id: string, next: (f: JudgeField) => JudgeField) =>
    setDraft((fs) => fs.map((f) => (f.id === id ? next(f) : f)));

  const close = () => {
    setConfirmDiscard(false);
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmDiscard(true) : close());

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await saveJudgeFields(slug, draft);
      if ("error" in result) return setError(result.error);
      onSaved(result.directory);
      onClose();
    });

  return (
    <>
      <EditDrawer
        isOpen={isOpen}
        onClose={requestClose}
        eyebrow="Judges"
        title="Custom fields"
        footer={
          <div className="flex w-full items-center gap-2">
            <span className="text-sm text-muted" aria-live="polite">
              {dirty && !pending ? (readOnly ? "Demo: changes aren't saved" : "Unsaved changes") : ""}
            </span>
            <Button className="ml-auto" variant="tertiary" onPress={requestClose}>
              Cancel
            </Button>
            <Button onPress={save} isDisabled={readOnly || !dirty || pending}>
              {pending ? "Saving…" : "Save fields"}
            </Button>
          </div>
        }
      >
        <SaveError error={error} />
        <p className="text-sm text-muted">
          Fields like Company or Track, each with a set of options. Pick one per judge, then filter and group by them.
        </p>

        {draft.map((f) => {
          const used = usage(f.id);
          return (
            <section key={f.id} className="flex flex-col gap-3 rounded-xl border-2 border-border p-4">
              <div className="flex items-end gap-2">
                <Field label="Field" className="flex-1">
                  <TextInput
                    value={f.name}
                    maxLength={60}
                    placeholder="Company"
                    autoFocus={!f.name}
                    onChange={(e) => update(f.id, (x) => ({ ...x, name: e.target.value }))}
                  />
                </Field>
                <ConfirmButton
                  variant="ghost"
                  isIconOnly
                  aria-label={`Remove ${f.name || "field"}`}
                  className="mb-1 text-muted hover:bg-danger-soft hover:text-danger"
                  title={`Remove “${f.name || "Untitled"}”?`}
                  description={
                    used
                      ? `${plural(used, "judge")} lose their ${f.name || "value"} when you save.`
                      : "It comes off every judge when you save."
                  }
                  confirmLabel="Remove field"
                  onConfirm={() => setDraft((fs) => fs.filter((x) => x.id !== f.id))}
                >
                  <PixelIcon name="trash" size={14} />
                </ConfirmButton>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Options</FieldLabel>
                {f.options.map((o) => {
                  const n = usage(f.id, o.id);
                  return (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        value={o.label}
                        maxLength={80}
                        aria-label="Option"
                        onChange={(e) =>
                          update(f.id, (x) => ({
                            ...x,
                            options: x.options.map((y) => (y.id === o.id ? { ...y, label: e.target.value } : y)),
                          }))
                        }
                        className={cn(inputClass, "min-h-9 flex-1 py-1.5 text-sm")}
                      />
                      <span className="w-16 text-right font-pixel text-xs text-muted" title={`${plural(n, "judge")}`}>
                        {n || ""}
                      </span>
                      <ConfirmButton
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label={`Remove ${o.label}`}
                        className="text-muted hover:bg-danger-soft hover:text-danger"
                        title={`Remove “${o.label || "Untitled"}”?`}
                        description={
                          n ? `${plural(n, "judge")} lose this ${f.name.toLowerCase() || "value"} when you save.` : undefined
                        }
                        confirmLabel="Remove option"
                        onConfirm={() =>
                          update(f.id, (x) => ({ ...x, options: x.options.filter((y) => y.id !== o.id) }))
                        }
                      >
                        <PixelIcon name="x" size={12} />
                      </ConfirmButton>
                    </div>
                  );
                })}
                <div className="pt-1">
                  <NewOptionChip
                    repeat
                    label="Add option"
                    onAdd={(label) =>
                      update(f.id, (x) =>
                        x.options.some((y) => y.label.trim().toLowerCase() === label.toLowerCase())
                          ? x
                          : { ...x, options: [...x.options, { id: crypto.randomUUID(), label }] },
                      )
                    }
                  />
                </div>
              </div>
            </section>
          );
        })}

        <AddTile onClick={() => setDraft((fs) => [...fs, blankField()])}>
          Add field
        </AddTile>
      </EditDrawer>

      <ConfirmDialog
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={close}
        title="Discard changes?"
        description="Your edits to the custom fields haven't been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
      />
    </>
  );
}
