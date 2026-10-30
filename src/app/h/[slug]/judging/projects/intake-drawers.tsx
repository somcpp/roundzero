"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Toggle, fieldLabelClass } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { cn } from "@/components/ui";
import { brand } from "@/lib/branding";
import type { SchemaBlock } from "@/lib/data";
import type { IntakeSettings } from "@/lib/intake";
import {
  regenerateApiKey,
  regenerateFormLink,
  setApiEnabled,
  setFormEnabled,
  type IntakeActionResult,
} from "@/lib/intake-actions";
import { API_KEY_PREFIX, LIMITS, agentPrompt, curlExample, intakeFields } from "@/lib/intake-shape";
import { projectHeadline } from "@/lib/project-fields";

/** Where the agent prompt tells agents to find the key when it isn't pasted in. */
const KEY_ENV = `${brand.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;

type Open = "api" | "form" | null;

/**
 * The Projects page's ways in besides "Add project": the intake API (for
 * scripts and agents) and a public submission form. Both post to /api/intake.
 */
export function IntakeButtons({
  slug,
  hackathonName,
  origin,
  settings: initial,
  blocks,
  judgingStarted,
}: {
  slug: string;
  hackathonName: string;
  origin: string;
  settings: IntakeSettings;
  blocks: SchemaBlock[];
  judgingStarted: boolean;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [settings, setSettings] = useState(initial);
  // The full API key, only while this page is open after it was made.
  const [freshKey, setFreshKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<IntakeActionResult>) =>
    new Promise<string | undefined>((resolve) =>
      startTransition(async () => {
        setError(undefined);
        const result = await action();
        if ("error" in result) {
          setError(result.error);
          return resolve(result.error);
        }
        setSettings(result.settings);
        if (result.key) setFreshKey(result.key);
        resolve(undefined);
      }),
    );

  const close = () => {
    setOpen(null);
    setError(undefined);
  };

  return (
    <>
      <Button variant="secondary" onPress={() => setOpen("api")}>
        <PixelIcon name="code" size={12} />
        API
        <StatusDot on={settings.apiEnabled} />
      </Button>
      <Button variant="secondary" onPress={() => setOpen("form")}>
        <PixelIcon name="globe" size={12} />
        Submission form
        <StatusDot on={settings.formEnabled} />
      </Button>

      <EditDrawer wide isOpen={open === "api"} onClose={close} eyebrow="Import projects" title="Projects API">
        <ApiPanel
          settings={settings}
          freshKey={freshKey}
          endpoint={`${origin}/api/intake`}
          hackathonName={hackathonName}
          blocks={blocks}
          slug={slug}
          pending={pending}
          error={error}
          onToggle={(on) => run(() => setApiEnabled(slug, on))}
          onRegenerate={() => run(() => regenerateApiKey(slug))}
        />
      </EditDrawer>

      <EditDrawer isOpen={open === "form"} onClose={close} eyebrow="Collect projects" title="Submission form">
        <FormPanel
          settings={settings}
          url={settings.formToken ? `${origin}/f/${settings.formToken}` : null}
          blocks={blocks}
          slug={slug}
          judgingStarted={judgingStarted}
          pending={pending}
          error={error}
          onToggle={(on) => run(() => setFormEnabled(slug, on))}
          onRegenerate={() => run(() => regenerateFormLink(slug))}
        />
      </EditDrawer>
    </>
  );
}

/** Lit only while the way in is on; nothing at all when it's off. */
function StatusDot({ on }: { on: boolean }) {
  if (!on) return null;
  return <span aria-label="On" className="size-2 rounded-full bg-accent" />;
}

// ── API ───────────────────────────────────────────────────────────────────

function ApiPanel({
  settings,
  freshKey,
  endpoint,
  hackathonName,
  blocks,
  slug,
  pending,
  error,
  onToggle,
  onRegenerate,
}: {
  settings: IntakeSettings;
  freshKey?: string;
  endpoint: string;
  hackathonName: string;
  blocks: SchemaBlock[];
  slug: string;
  pending: boolean;
  error?: string;
  onToggle: (on: boolean) => void;
  onRegenerate: () => Promise<string | undefined>;
}) {
  const fields = intakeFields(blocks);
  const key = freshKey ?? `$${KEY_ENV}`;
  const prompt = agentPrompt({ hackathon: hackathonName, endpoint, key, fields });
  const readOnly = useReadOnly();

  return (
    <>
      <SaveError error={error} />
      {!settings.configured && <NotConfigured />}
      <Toggle
        checked={settings.apiEnabled}
        // Flipping it saves straight away, so a demo can't.
        disabled={readOnly}
        onChange={(on) => !pending && onToggle(on)}
        label="API access"
        description="Let scripts and coding agents create projects, e.g. to import a spreadsheet or another platform's export."
      />

      {settings.apiEnabled && (
        <>
          <Section title="Endpoint">
            <CopyField value={endpoint} />
          </Section>

          <Section title="API key">
            {freshKey ? (
              <>
                <CopyField value={freshKey} />
                <p className="text-xs text-warning-soft-foreground">
                  Copy it now. For safety it&apos;s stored hashed, so it won&apos;t be shown again after you leave this page.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <code className="min-w-0 flex-1 truncate rounded-lg border-2 border-border bg-surface-secondary px-3 py-2 font-mono text-sm text-muted">
                  {API_KEY_PREFIX}
                  {"•".repeat(16)}
                  {settings.apiKeyHint}
                </code>
                <ConfirmButton
                  title="Regenerate the API key?"
                  description="The current key stops working straight away. Anything using it will need the new one."
                  confirmLabel="Regenerate"
                  pendingLabel="Regenerating…"
                  onConfirm={onRegenerate}
                >
                  Regenerate
                </ConfirmButton>
              </div>
            )}
            {!freshKey && settings.apiKeyCreatedAt && (
              <p className="text-xs text-muted">
                Created {new Date(settings.apiKeyCreatedAt).toLocaleDateString()}. Lost it? Regenerate to get a new one.
              </p>
            )}
          </Section>

          <Section
            title="Agent prompt"
            action={<CopyButton value={prompt} label="Copy prompt" />}
          >
            <p className="text-sm text-muted">
              Paste this into a local coding agent (Claude Code, Cursor…) and point it at your spreadsheet or export.
              It maps your columns to these fields, checks with you, then imports.
              {!freshKey && (
                <>
                  {" "}
                  The key isn&apos;t included: set <code className="font-mono text-xs">{KEY_ENV}</code> in the
                  agent&apos;s environment, or regenerate to copy a prompt with the key in it.
                </>
              )}
            </p>
            <CodeBlock value={prompt} maxHeight="max-h-64" wrap />
          </Section>

          <Section title="Fields">
            {fields.length === 0 ? (
              <p className="text-sm text-muted">
                The schema has no fields yet.{" "}
                <Link href={`/h/${slug}/setup/schema`} className="underline underline-offset-4">
                  Set it up
                </Link>{" "}
                first.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border-2 border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-left font-pixel text-xs text-muted uppercase">
                      <th className="px-3 py-2 font-normal">Key</th>
                      <th className="px-3 py-2 font-normal">Type</th>
                      <th className="px-3 py-2 font-normal">Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((f) => (
                      <tr key={f.blockId}>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{f.key}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted">{f.shape}</td>
                        <td className="px-3 py-2">
                          {f.title}
                          {f.expected && <span className="text-muted"> · {f.expected}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted">
              Keys follow the field titles in Setup › Schema, so renaming a field renames its key. Agents can{" "}
              <code className="font-mono">GET</code> the endpoint for the current list.
            </p>
          </Section>

          <Section
            title="Example request"
            action={<CopyButton value={curlExample(endpoint, key, fields)} label="Copy" />}
          >
            <CodeBlock value={curlExample(endpoint, key, fields)} />
            <p className="text-xs text-muted">
              Up to 100 projects per request, all or nothing. {LIMITS.api.limit} requests a minute per key.
            </p>
          </Section>
        </>
      )}
    </>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────

function FormPanel({
  settings,
  url,
  blocks,
  slug,
  judgingStarted,
  pending,
  error,
  onToggle,
  onRegenerate,
}: {
  settings: IntakeSettings;
  url: string | null;
  blocks: SchemaBlock[];
  slug: string;
  judgingStarted: boolean;
  pending: boolean;
  error?: string;
  onToggle: (on: boolean) => void;
  onRegenerate: () => Promise<string | undefined>;
}) {
  const { nameBlockId } = projectHeadline({ number: 0, values: {} }, blocks);
  const readOnly = useReadOnly();
  return (
    <>
      <SaveError error={error} />
      {!settings.configured && <NotConfigured />}
      <Toggle
        checked={settings.formEnabled}
        disabled={readOnly}
        onChange={(on) => !pending && onToggle(on)}
        label="Accept submissions"
        description="A public page where entrants submit their project. Each one shows up here straight away."
      />

      {settings.formEnabled && url && (
        <>
          <Section title="Public link">
            <CopyField value={url} />
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
              >
                Open form <PixelIcon name="external" size={10} />
              </a>
              <ConfirmButton
                variant="ghost"
                className="ml-auto"
                title="Make a new link?"
                description="The current link stops working straight away. Share the new one with entrants."
                confirmLabel="Make new link"
                pendingLabel="Making…"
                onConfirm={onRegenerate}
              >
                New link
              </ConfirmButton>
            </div>
          </Section>

          {judgingStarted && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
              Judging has started. New submissions won&apos;t be in a phase until you move them into one.
            </p>
          )}

          <Section title="Entrants fill in">
            <ul className="flex flex-col divide-y divide-border rounded-lg border-2 border-border text-sm">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-baseline gap-2 px-3 py-2">
                  <span>{b.title}</span>
                  {b.id === nameBlockId && <span className="text-xs text-muted">required</span>}
                  <span className="ml-auto truncate text-xs text-muted">{b.type}</span>
                </li>
              ))}
            </ul>
            <Link href={`/h/${slug}/setup/schema`} className="text-sm underline underline-offset-4">
              Edit in Setup › Schema
            </Link>
          </Section>

          <p className="text-xs text-muted">
            Spam protection: each visitor can submit {LIMITS.formIp.limit} projects every{" "}
            {LIMITS.formIp.seconds / 60} minutes, and a hidden field catches most bots. If the link gets abused, make a
            new one or switch the form off.
          </p>
        </>
      )}
    </>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────

function NotConfigured() {
  return (
    <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
      This server can&apos;t take outside submissions yet. Add <code className="font-mono">SUPABASE_SECRET_KEY</code>{" "}
      (Supabase › Project Settings › API Keys) to the environment and restart.
    </p>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center gap-2">
        <h3 className={fieldLabelClass}>{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button size="sm" variant="secondary" onPress={() => copy(value)}>
      <PixelIcon name={copied ? "check" : "copy"} size={12} />
      {copied ? "Copied" : label}
    </Button>
  );
}

function CopyField({ value }: { value: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border-2 border-border bg-surface-secondary px-3 py-2 font-mono text-sm">
        {value}
      </code>
      <Button isIconOnly size="sm" variant="secondary" aria-label="Copy" onPress={() => copy(value)}>
        <PixelIcon name={copied ? "check" : "copy"} size={12} />
      </Button>
    </div>
  );
}

function CodeBlock({ value, maxHeight = "max-h-80", wrap }: { value: string; maxHeight?: string; wrap?: boolean }) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded-lg border-2 border-border bg-surface-secondary p-3 font-mono text-xs leading-relaxed",
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        maxHeight,
      )}
    >
      {value}
    </pre>
  );
}
