"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@heroui/react";
import { BlockInput } from "@/components/block-input";
import { ContactEmailInput } from "@/components/contact-email-input";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { Panel } from "@/components/ui";
import type { SchemaBlock } from "@/lib/data";
import { formatNumber, projectHeadline } from "@/lib/project-fields";

type Status = { kind: "editing" } | { kind: "sending" } | { kind: "done"; number: number | null };

/** The public project form: one input per schema block, then a contact email, sent to /api/intake. */
export function SubmissionForm({ token, blocks }: { token: string; blocks: SchemaBlock[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [contactEmail, setContactEmail] = useState("");
  // Honeypot: hidden from people, so only bots fill it in.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const [error, setError] = useState<string>();
  const { nameBlockId } = projectHeadline({ number: 0, values: {} }, blocks);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: token, values, contactEmail, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't submit. Try again.");
        return setStatus({ kind: "editing" });
      }
      setStatus({ kind: "done", number: body.created?.[0]?.number ?? null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus({ kind: "editing" });
    }
  };

  if (status.kind === "done") {
    return (
      <Panel className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-xl bg-success-soft text-success-soft-foreground">
          <PixelIcon name="check" size={24} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl">Project submitted</h2>
          <p className="text-muted">
            {status.number ? `It's in as project ${formatNumber(status.number)}. ` : ""}
            The organizers will take it from here.
          </p>
        </div>
        <Button
          variant="secondary"
          onPress={() => {
            setValues({});
            setContactEmail("");
            setStatus({ kind: "editing" });
          }}
        >
          Submit another project
        </Button>
      </Panel>
    );
  }

  const sending = status.kind === "sending";
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {blocks.length === 0 ? (
        <p className="text-muted">This form has no fields yet. Check back soon.</p>
      ) : (
        <>
          {blocks.map((b) => (
            <BlockInput
              key={b.id}
              block={b}
              value={values[b.id] ?? ""}
              required={b.id === nameBlockId}
              onChange={(v) => setValues((s) => ({ ...s, [b.id]: v }))}
            />
          ))}
          <ContactEmailInput value={contactEmail} required onChange={setContactEmail} />
        </>
      )}

      <label aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <SaveError error={error} />
        <Button type="submit" size="lg" isDisabled={sending || blocks.length === 0} className="self-start">
          {sending ? "Submitting…" : "Submit project"}
        </Button>
      </div>
    </form>
  );
}
