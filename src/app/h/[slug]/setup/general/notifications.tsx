"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { Field, TextInput } from "@/components/controls";
import { SaveError } from "@/components/list-editor";
import { Panel } from "@/components/ui";
import { saveNotifyEmail } from "@/lib/email-actions";

/**
 * Where "phase done" and "phase due" emails go. Judging never moves on by
 * itself, so these are how the owner hears it's their turn. Blank uses the
 * owner's account email.
 */
export function Notifications({
  slug,
  notifyEmail,
  ownerEmail,
  sending,
}: {
  slug: string;
  notifyEmail: string;
  /** The signed-in owner's account email, the default. */
  ownerEmail: string | null;
  /** How this server sends email: the sender address, where it's redirected in development, or why it's off. */
  sending: { from: string; redirectTo: string | null } | { missing: string };
}) {
  const [value, setValue] = useState(notifyEmail);
  const [saved, setSaved] = useState(notifyEmail);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const dirty = value.trim().toLowerCase() !== saved;

  const save = () =>
    start(async () => {
      setError(undefined);
      const result = await saveNotifyEmail(slug, value);
      if ("error" in result) return setError(result.error);
      setSaved(value.trim().toLowerCase());
    });

  return (
    <Panel className="flex flex-col gap-5 p-6">
      <Field label="Send owner updates to" hint={ownerEmail ? `blank uses ${ownerEmail}` : "optional"}>
        <TextInput
          type="email"
          inputMode="email"
          value={value}
          placeholder={ownerEmail ?? "you@example.com"}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted">
        When every review for a phase is in, or a phase&apos;s days run out, you get an email. Nothing moves on until
        you close the phase from Progress.
      </p>
      <SaveError error={error} />
      <div className="flex items-center gap-3">
        <Button onPress={save} isDisabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {!dirty && saved !== notifyEmail && !pending && <span className="text-sm text-muted">Saved</span>}
      </div>
      <p className="border-t border-border pt-4 text-xs text-muted">
        {"missing" in sending ? (
          <span className="text-danger">Emails are off on this server: {sending.missing}.</span>
        ) : (
          <>
            Emails send from {sending.from}.
            {sending.redirectTo && ` Development mode: every email goes to ${sending.redirectTo} instead.`}
          </>
        )}
      </p>
    </Panel>
  );
}
