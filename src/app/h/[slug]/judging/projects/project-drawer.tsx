"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { BlockInput } from "@/components/block-input";
import { ContactEmailInput } from "@/components/contact-email-input";
import { ConfirmDialog } from "@/components/confirm-button";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError } from "@/components/list-editor";
import { useReadOnly } from "@/components/read-only";
import type { ProjectValue, SchemaBlock } from "@/lib/data";
import { saveProject } from "@/lib/judging-actions";

export type ProjectDraft = { id: string; values: Record<string, ProjectValue>; contactEmail: string };

/** Form state: every value as the string its input holds; lists are one entry per line. */
type FormValues = Record<string, string>;

/** The contact email's slot in the form state; block ids are uuids, so it can't collide. */
const CONTACT = "contact_email";

const toForm = (values: Record<string, ProjectValue>): FormValues =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.join("\n") : String(v)]));

const snapshot = (v: FormValues) =>
  JSON.stringify(
    Object.entries(v)
      .map(([k, s]) => [k, s.trim()])
      .filter(([, s]) => s)
      .sort(),
  );

/**
 * Drawer to add or edit one project. The form is built from the hackathon's
 * project schema, one input per block. Stays mounted; `target` null closes it.
 */
export function ProjectDrawer({
  target,
  isNew,
  title,
  blocks,
  slug,
  onClose,
  onSaved,
}: {
  target: ProjectDraft | null;
  isNew: boolean;
  title?: string;
  blocks: SchemaBlock[];
  slug: string;
  onClose: () => void;
  onSaved?: (number: number) => void;
}) {
  // Reset the form whenever a different project opens; keep the last one while closing.
  const [openFor, setOpenFor] = useState(target);
  const [form, setForm] = useState<FormValues>(() => ({ ...toForm(target?.values ?? {}), [CONTACT]: target?.contactEmail ?? "" }));
  const [original, setOriginal] = useState<FormValues>(form);
  const [error, setError] = useState<string>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const readOnly = useReadOnly();
  if (target !== openFor) {
    setOpenFor(target);
    if (target) {
      const next = { ...toForm(target.values), [CONTACT]: target.contactEmail };
      setForm(next);
      setOriginal(next);
      setError(undefined);
    }
  }

  const dirty = snapshot(form) !== snapshot(original);
  const { [CONTACT]: contactEmail = "", ...values } = form;
  const empty = snapshot(values) === "[]";
  const close = () => {
    setConfirmDiscard(false);
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmDiscard(true) : close());

  const save = () =>
    startTransition(async () => {
      if (!target) return;
      setError(undefined);
      const result = await saveProject(slug, { id: target.id, values, contactEmail });
      if ("error" in result) return setError(result.error);
      onSaved?.(result.number!);
      onClose();
    });

  return (
    <>
      <EditDrawer
        isOpen={!!target}
        onClose={requestClose}
        eyebrow={isNew ? "New project" : "Edit project"}
        title={title || "Untitled project"}
        footer={
          target && (
            <div className="flex w-full items-center gap-2">
              <span className="mr-auto text-sm text-muted" aria-live="polite">
                {dirty && !pending ? (readOnly ? "Demo: changes aren't saved" : "Unsaved changes") : ""}
              </span>
              <Button variant="tertiary" onPress={requestClose}>
                Cancel
              </Button>
              <Button onPress={save} isDisabled={readOnly || pending || empty || (!dirty && !isNew)}>
                {pending ? "Saving…" : isNew ? "Add project" : "Save"}
              </Button>
            </div>
          )
        }
      >
        {target && (
          <>
            <SaveError error={error} />
            {blocks.length === 0 && (
              <p className="text-sm text-muted">
                The project schema has no blocks yet. Add some in Setup › Schema first.
              </p>
            )}
            {blocks.map((b, i) => (
              <BlockInput
                key={b.id}
                block={b}
                value={form[b.id] ?? ""}
                autoFocus={isNew && i === 0}
                onChange={(v) => setForm((f) => ({ ...f, [b.id]: v }))}
              />
            ))}
            <ContactEmailInput value={contactEmail} onChange={(v) => setForm((f) => ({ ...f, [CONTACT]: v }))} />
          </>
        )}
      </EditDrawer>

      <ConfirmDialog
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={close}
        title="Discard changes?"
        description={isNew ? "This project hasn't been added yet." : "Your edits to this project haven't been saved."}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
      />
    </>
  );
}
