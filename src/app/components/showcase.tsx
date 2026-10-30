"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BRAND_COLORS, brand, foregroundFor } from "@/lib/branding";
import { cn } from "@/components/ui";
import * as actions from "./sections/actions";
import * as forms from "./sections/forms";
import * as pickers from "./sections/pickers";
import * as overlays from "./sections/overlays";

const SECTIONS = [actions, forms, pickers, overlays];

const TOKENS = [
  ["Surfaces", ["background", "background-secondary", "surface", "surface-secondary", "surface-tertiary", "overlay", "default"]],
  ["Text", ["foreground", "muted", "link", "field-placeholder"]],
  ["Accent", ["accent", "accent-hover", "accent-soft", "accent-soft-foreground", "accent-foreground", "focus"]],
  ["Status", ["success", "success-soft", "warning", "warning-soft", "danger", "danger-soft"]],
  ["Lines", ["border", "border-secondary", "separator", "field-border", "field-background"]],
] as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const noop = () => () => {};

export function Showcase() {
  const [color, setColor] = useState(brand.color);
  // Client-only demos: date/number fields format by locale, which differs between server and browser.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  // Set on <html> (not a wrapper) so portalled popovers and modals pick it up too.
  useEffect(() => {
    if (!HEX.test(color)) return;
    const root = document.documentElement.style;
    const prev = [root.getPropertyValue("--accent"), root.getPropertyValue("--accent-foreground")];
    root.setProperty("--accent", color);
    root.setProperty("--accent-foreground", foregroundFor(color));
    return () => {
      root.setProperty("--accent", prev[0]);
      root.setProperty("--accent-foreground", prev[1]);
    };
  }, [color]);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-8 py-10 lg:grid-cols-[200px_1fr]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
        <div className="flex flex-col gap-1">
          <span className="font-pixel text-lg">Components</span>
          <span className="text-xs text-muted">HeroUI v3 · dev only</span>
        </div>
        <nav className="flex flex-col gap-4 text-sm">
          <a href="#tokens" className="text-muted hover:text-foreground">
            Tokens
          </a>
          {SECTIONS.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <a href={`#${s.id}`} className="font-medium hover:text-accent">
                {s.title}
              </a>
              {s.components.map((name) => (
                <a key={name} href={`#c-${name}`} className="pl-3 text-muted hover:text-foreground">
                  {name}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-col gap-14">
        <section id="tokens" className="flex scroll-mt-8 flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
            <h1 className="text-3xl">Tokens</h1>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(BRAND_COLORS).map(([name, hex]) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  onClick={() => setColor(hex)}
                  className={cn(
                    "size-6 rounded-md border-2 transition",
                    color === hex ? "border-foreground" : "border-transparent hover:scale-110",
                  )}
                  style={{ background: hex }}
                />
              ))}
              <input
                type="color"
                value={HEX.test(color) && color.length === 7 ? color : "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className="size-7 cursor-pointer rounded-md border border-border bg-surface p-0.5"
                aria-label="Custom accent"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs"
                aria-label="Accent hex"
              />
            </div>
          </div>
          <p className="text-sm text-muted">
            Accent preview only — set the real brand color in <code className="font-mono">branding.config.js</code>.
          </p>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {TOKENS.map(([group, names]) => (
              <div key={group} className="flex flex-col gap-2">
                <span className="font-pixel text-[11px] uppercase tracking-wide text-muted">{group}</span>
                {names.map((t) => (
                  <div key={t} className="flex items-center gap-3">
                    <span
                      className="size-7 shrink-0 rounded-md border border-border"
                      style={{ background: `var(--${t})` }}
                    />
                    <code className="font-mono text-xs">--{t}</code>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {mounted && SECTIONS.map((s) => <s.default key={s.id} />)}
      </main>
    </div>
  );
}
