import type { Metadata } from "next";
import type { ReactNode } from "react";
import config from "../../../branding.config.js";
import { AppBar } from "@/components/app-bar";
import { BrandMark } from "@/components/brand-mark";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, cn, PageHeader, Panel, TextLink } from "@/components/ui";
import { BRAND_COLORS, brand, type BrandingConfig } from "@/lib/branding";
import { DEMO_MODE } from "@/lib/demo";

export const metadata: Metadata = { title: `Settings — ${brand.name}` };

// This instance is self-hosted, so every setting lives in code or the
// environment. The page only reports what's configured and where to change it.

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs">{children}</code>;
}

function Section({ title, hint, children }: { title: ReactNode; hint: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-8 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="text-lg leading-none">{title}</h2>
        <p className="mt-2 text-xs text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Option({ name, value, children }: { name: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-6 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Code>{name}</Code>
        <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">{value}</div>
      </div>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

function EnvStatus({ set, value }: { set: boolean; value?: string }) {
  if (!set) return <Badge tone="danger">not set</Badge>;
  return value ? <span className="truncate font-mono text-xs">{value}</span> : <Badge tone="success">set</Badge>;
}

export default function SettingsPage() {
  const cfg = config as BrandingConfig;
  const env = process.env;

  return (
    <>
      <AppBar />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-8 py-14">
        <PageHeader
          title="Settings"
          hint="This instance is self-hosted. Settings live in code and the environment, so this page is read-only."
        />

        <Section
          title="Branding"
          hint={
            <>
              Set in <Code>branding.config.js</Code> at the repo root. Restart or redeploy to apply.
            </>
          }
        >
          <Panel className="divide-y divide-border">
            <div className="flex items-center gap-4 px-6 py-5">
              <BrandMark className="size-12 rounded-lg" badgeClassName="lip bg-accent text-base text-accent-foreground" />
              <div className="flex flex-col gap-1">
                <span className="font-pixel text-lg leading-none">{brand.name}</span>
                <span className="text-xs text-muted">Current header, page titles and footers</span>
              </div>
            </div>
            <Option name="name" value={<span className="font-medium">{brand.name}</span>}>
              Product name shown in the header, browser tab titles and the &ldquo;Judged with&rdquo; footer.
            </Option>
            <Option name="badge" value={<span className="font-pixel">{brand.badge}</span>}>
              Short text mark, 1–3 characters. Shown in place of a logo when <Code>logo</Code> is empty.
            </Option>
            <Option
              name="logo"
              value={brand.logo ? <span className="font-mono text-xs">{brand.logo}</span> : <Badge>none</Badge>}
            >
              Path to a square image in <Code>/public</Code>, like <Code>&quot;/logo.svg&quot;</Code>. Replaces the
              badge everywhere.
            </Option>
            <Option
              name="color"
              value={
                <>
                  <span className="size-4 rounded border-2 border-border bg-accent" />
                  <span className="font-mono text-xs">{cfg.color}</span>
                </>
              }
            >
              Accent color for buttons, links and highlights. Use one of the presets below or any hex like{" "}
              <Code>&quot;#ff5a1f&quot;</Code>. Text on the accent switches between light and dark automatically.
            </Option>
            <div className="flex flex-wrap gap-2 px-6 py-4">
              {Object.entries(BRAND_COLORS).map(([name, hex]) => (
                <span
                  key={name}
                  className={cn(
                    "flex items-center gap-2 rounded-md border-2 px-2 py-1 font-mono text-xs",
                    hex === brand.color ? "border-foreground" : "border-border text-muted",
                  )}
                >
                  <span className="size-3 rounded-sm" style={{ background: hex }} />
                  {name}
                </span>
              ))}
            </div>
          </Panel>
        </Section>

        <Section
          title="Environment"
          hint={
            <>
              Set in <Code>.env.local</Code> for local dev, or your host&apos;s environment variables in production.
            </>
          }
        >
          <Panel className="divide-y divide-border">
            <Option
              name="NEXT_PUBLIC_SUPABASE_URL"
              value={<EnvStatus set={!!env.NEXT_PUBLIC_SUPABASE_URL} value={env.NEXT_PUBLIC_SUPABASE_URL} />}
            >
              Your Supabase project URL. Required. Used for auth, the database and public storage URLs.
            </Option>
            <Option
              name="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
              value={<EnvStatus set={!!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} />}
            >
              The project&apos;s publishable key, from Project Settings → API Keys. Required.
            </Option>
            <Option
              name="SUPABASE_SECRET_KEY"
              value={<EnvStatus set={!!(env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY)} />}
            >
              Server-only secret key (Supabase › Project Settings › API Keys). Lets the project intake API and public
              submission forms write projects without a signed-in admin. Never expose it to the browser.
            </Option>
            <Option name="SUPABASE_DB_PASSWORD" value={<EnvStatus set={!!env.SUPABASE_DB_PASSWORD} />}>
              Database password for the Supabase CLI. Only needed to run migrations; the app doesn&apos;t use it.
            </Option>
            <Option name="DEMO_MODE" value={DEMO_MODE ? <Badge tone="success">on</Badge> : <Badge>off</Badge>}>
              Set to <Code>true</Code> to fill in the shared demo login on the sign-in page (<Code>DEMO_EMAIL</Code>{" "}
              and <Code>DEMO_PASSWORD</Code>; <Code>pnpm demo:seed</Code> creates it). The demo account can try
              anything in the demo hackathons, but nothing it changes is saved.
            </Option>
          </Panel>
        </Section>

        <Section
          title="Database"
          hint={
            <>
              Schema and storage buckets are defined in <Code>supabase/migrations</Code>.
            </>
          }
        >
          <Panel className="flex flex-col gap-4 p-6 text-sm">
            <p>
              Apply migrations to your project with <Code>pnpm supabase db push</Code>. They create every table,
              row-level security policy and storage bucket the app needs.
            </p>
            <div className="flex flex-wrap gap-2">
              <Code>judge-images</Code>
              <Code>hackathon-logos</Code>
              <Code>reward-images</Code>
            </div>
            <p className="text-muted">
              All three buckets are public so photos, logos and prize images show on judge links, winners pages and emails.
            </p>
          </Panel>
        </Section>

        <Section title="Admins" hint="Managed in Supabase Auth. There is no public sign-up.">
          <Panel className="flex gap-3 p-6 text-sm">
            <PixelIcon name="lock" size={14} className="mt-0.5 shrink-0 text-muted" />
            <p className="text-muted">
              Create admin accounts by hand in the Supabase dashboard. <TextLink href="/signup">See the steps</TextLink>.
            </p>
          </Panel>
        </Section>
      </main>
    </>
  );
}
