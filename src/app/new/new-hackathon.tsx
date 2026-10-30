"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type CSSProperties } from "react";
import { Button } from "@heroui/react";
import { Field, TextInput } from "@/components/controls";
import { DateRangeField } from "@/components/date-range-field";
import { PixelIcon } from "@/components/pixel-icon";
import { LogoMark, PixelCover } from "@/components/ui";
import { brand } from "@/lib/branding";
import { createHackathon } from "@/lib/hackathon-actions";
import { formatDates, initials } from "@/lib/format-hackathon";

export function NewHackathon() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createHackathon, undefined);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const color = brand.color;

  return (
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_320px]">
      <form action={formAction} className="flex flex-col gap-8">
        <h1 className="text-4xl leading-none font-medium">Start a hackathon</h1>

        <input type="hidden" name="color" value={color} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <TextInput
              name="name"
              autoFocus
              required
              maxLength={120}
              placeholder="AI Agents Hack 2027"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Tagline" hint="optional" className="sm:col-span-2">
            <TextInput name="tagline" maxLength={200} placeholder="Build agents that ship real work." />
          </Field>
          <DateRangeField
            label="Dates"
            startName="starts_on"
            endName="ends_on"
            className="sm:col-span-2"
            onChange={(start, end) => {
              setStartsOn(start);
              setEndsOn(end);
            }}
          />
        </div>

        {state?.error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" isDisabled={!name.trim() || pending}>
            {pending ? "Creating…" : "Create & set up"} <PixelIcon name="arrow-right" size={12} />
          </Button>
          <Button variant="ghost" onPress={() => router.push("/")}>
            Cancel
          </Button>
        </div>
      </form>

      <div className="brand flex flex-col gap-3" style={{ "--brand": color } as CSSProperties}>
        <span className="font-pixel text-xs uppercase tracking-wide text-muted">Preview</span>
        <div className="overflow-hidden rounded-2xl border border-border">
          <PixelCover seed={name || "new"} color={color} className="h-44">
            <div className="p-6">
              <LogoMark text={initials(name) || "?"} color={color} size={40} />
            </div>
          </PixelCover>
          <div className="flex flex-col gap-1 p-6">
            <span className="font-pixel text-lg">{name || "Untitled hackathon"}</span>
            <span className="text-sm text-muted">{formatDates(startsOn || null, endsOn || null)} · setup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
