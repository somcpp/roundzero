"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { useReadOnly } from "./read-only";

/**
 * State for a page that edits a whole list and saves it in one go: tracks
 * unsaved changes against the last save and swaps in the server's copy after.
 * `snapshot` should serialize only the fields that are saved.
 */
export function useListEditor<T>(
  initial: T[],
  save: (items: T[]) => Promise<{ error: string } | { items: T[] }>,
  snapshot: (items: T[]) => string,
) {
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startSave] = useTransition();

  const edit = (next: (items: T[]) => T[]) => {
    setItems(next);
    setJustSaved(false);
  };

  const submit = () =>
    startSave(async () => {
      setError(undefined);
      const result = await save(items);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setItems(result.items);
      setSaved(result.items);
      setJustSaved(true);
    });

  const dirty = snapshot(items) !== snapshot(saved);
  return { items, saved, edit, dirty, pending, error, justSaved, submit };
}

/** Header actions for a list editor: save status plus the Update button (off in read-only views). */
export function UpdateButton({
  dirty,
  pending,
  justSaved,
  onPress,
}: {
  dirty: boolean;
  pending: boolean;
  justSaved: boolean;
  onPress: () => void;
}) {
  const readOnly = useReadOnly();
  return (
    <>
      <span className="text-sm text-muted" aria-live="polite">
        {pending ? "" : dirty ? (readOnly ? "Demo: changes aren't saved" : "Unsaved changes") : justSaved ? "Saved" : ""}
      </span>
      <Button onPress={onPress} isDisabled={readOnly || !dirty || pending}>
        {pending ? "Updating…" : "Update"}
      </Button>
    </>
  );
}

export function SaveError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
      {error}
    </p>
  );
}
