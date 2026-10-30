"use client";

import { useActionState } from "react";
import { Button } from "@heroui/react";
import { Field, TextInput } from "@/components/controls";
import { signIn } from "@/lib/auth";

/** `demo` fills in the shared demo login (DEMO_MODE, see lib/demo.ts), so visitors just click Sign in. */
export function LoginForm({ next, demo }: { next?: string; demo?: { email: string; password: string } }) {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      {demo && (
        <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent-soft-foreground">
          <strong>The demo login is filled in.</strong> Sign in to look around three sample hackathons. You can try
          anything, but nothing you change is saved.
        </p>
      )}
      <Field label="Email">
        <TextInput
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.email ?? demo?.email}
          placeholder="you@example.com"
          required
          autoFocus={!demo}
        />
      </Field>
      <Field label="Password">
        <TextInput name="password" type="password" autoComplete="current-password" defaultValue={demo?.password} required />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-soft-foreground">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" isDisabled={pending} className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
