"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, Select, TextInput } from "@/components/controls";
import { DateRangeField } from "@/components/date-range-field";
import { useReadOnly } from "@/components/read-only";
import { PageHeader, Panel } from "@/components/ui";
import type { Hackathon } from "@/lib/data";
import { STAGES } from "@/lib/format-hackathon";
import { deleteHackathon, updateHackathon } from "@/lib/hackathon-actions";

export function HackathonSettings({ hackathon, notifications }: { hackathon: Hackathon; notifications?: ReactNode }) {
  const [state, formAction, pending] = useActionState(updateHackathon.bind(null, hackathon.slug), undefined);
  const readOnly = useReadOnly();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-12">
      <PageHeader title="General" hint={`/h/${hackathon.slug}`} />

      <section className="grid gap-8 md:grid-cols-[200px_1fr]">
        <div>
          <h2 className="text-lg leading-none">Details</h2>
          <p className="mt-2 text-xs text-muted">Name, dates and where the event is in its lifecycle.</p>
        </div>
        <Panel className="p-6">
          <form action={formAction} className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <TextInput name="name" required maxLength={120} defaultValue={hackathon.name} />
            </Field>
            <Field label="Tagline" hint="optional" className="sm:col-span-2">
              <TextInput name="tagline" maxLength={200} defaultValue={hackathon.tagline} />
            </Field>
            <DateRangeField
              label="Dates"
              startName="starts_on"
              endName="ends_on"
              defaultStart={hackathon.startsOn}
              defaultEnd={hackathon.endsOn}
              className="sm:col-span-2"
            />
            <Field label="Stage">
              <Select
                name="stage"
                defaultValue={hackathon.stage}
                options={STAGES}
                className="capitalize"
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="hidden" name="published_present" value="1" />
              <input type="checkbox" name="published" defaultChecked={hackathon.published} className="size-4 accent-[var(--accent)]" />
              Winners page is public
            </label>

            {state?.error && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground sm:col-span-2">
                {state.error}
              </p>
            )}
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" isDisabled={readOnly || pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
              {state?.saved && !pending && <span className="text-sm text-muted">Saved</span>}
            </div>
          </form>
        </Panel>
      </section>

      {notifications && (
        <section className="grid gap-8 md:grid-cols-[200px_1fr]">
          <div>
            <h2 className="text-lg leading-none">Notifications</h2>
            <p className="mt-2 text-xs text-muted">Where you hear it&apos;s time to move judging on.</p>
          </div>
          {notifications}
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-[200px_1fr]">
        <div>
          <h2 className="text-lg leading-none">Danger zone</h2>
        </div>
        <Panel className="flex items-center gap-4 p-6">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-sm">Delete this hackathon</span>
            <span className="text-xs text-muted">Removes it for everyone, including the public winners page.</span>
          </div>
          <DeleteButton hackathon={hackathon} />
        </Panel>
      </section>
    </div>
  );
}

function DeleteButton({ hackathon }: { hackathon: Hackathon }) {
  return (
    <ConfirmButton
      title={`Delete ${hackathon.name}?`}
      description="This can't be undone."
      confirmLabel="Delete hackathon"
      pendingLabel="Deleting…"
      onConfirm={async () => (await deleteHackathon(hackathon.slug))?.error}
    >
      Delete
    </ConfirmButton>
  );
}
