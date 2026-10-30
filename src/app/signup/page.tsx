import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { PixelIcon } from "@/components/pixel-icon";
import { ButtonLink, Eyebrow, Panel } from "@/components/ui";
import { brand } from "@/lib/branding";

export const metadata: Metadata = { title: `Sign up — ${brand.name}` };

// https://<ref>.supabase.co → <ref>, so dashboard links open the right project.
function projectRef() {
  const host = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return host?.[1] ?? "_";
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft font-pixel text-sm text-accent-soft-foreground">
        {n}
      </span>
      <div className="flex flex-col gap-1 pt-1 text-[15px]">{children}</div>
    </li>
  );
}

function Path({ children }: { children: ReactNode }) {
  return <span className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs">{children}</span>;
}

export default function SignupPage() {
  const dashboard = `https://supabase.com/dashboard/project/${projectRef()}`;

  return (
    <main className="grid flex-1 place-items-center px-6 py-16">
      <div className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark className="size-14 rounded-xl" badgeClassName="lip bg-accent text-lg text-accent-foreground" />
          <div className="flex flex-col gap-2">
            <h1 className="font-pixel text-3xl leading-none">Admins are added by hand</h1>
            <p className="text-sm text-muted">
              {brand.name} has no public sign-up. Someone with access to the Supabase project creates each admin
              account directly.
            </p>
          </div>
        </div>

        <Panel className="flex flex-col gap-5 p-7">
          <Eyebrow>Add an admin in Supabase</Eyebrow>
          <ol className="flex flex-col gap-5">
            <Step n={1}>
              <span>
                Open the{" "}
                <a href={`${dashboard}/auth/users`} target="_blank" rel="noreferrer" className="underline decoration-border-secondary underline-offset-4 hover:decoration-accent">
                  Users page
                </a>{" "}
                in the Supabase dashboard.
              </span>
              <span className="text-muted">
                <Path>Authentication → Users</Path>
              </span>
            </Step>
            <Step n={2}>
              <span>
                Click <strong>Add user</strong>, then <strong>Create new user</strong>.
              </span>
            </Step>
            <Step n={3}>
              <span>Enter the admin&apos;s email and a password.</span>
              <span className="text-muted">
                Leave <strong>Auto Confirm User</strong> checked so they can sign in right away without a
                confirmation email.
              </span>
            </Step>
            <Step n={4}>
              <span>Send them the password over a private channel. They sign in at /login.</span>
            </Step>
          </ol>
        </Panel>

        <Panel className="flex gap-3 p-5 text-sm">
          <PixelIcon name="lock" size={14} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-muted">
            Recommended: turn off public sign-ups so nobody can create an account through the Supabase API. In the
            dashboard, go to{" "}
            <a href={`${dashboard}/auth/providers`} target="_blank" rel="noreferrer" className="underline decoration-border-secondary underline-offset-4 hover:decoration-accent">
              <Path>Authentication → Sign In / Providers</Path>
            </a>{" "}
            and switch off <strong>Allow new users to sign up</strong>. Accounts you create by hand still work.
          </p>
        </Panel>

        <ButtonLink href="/login" variant="secondary" className="self-center">
          <PixelIcon name="arrow-left" size={12} /> Back to sign in
        </ButtonLink>
      </div>
    </main>
  );
}
