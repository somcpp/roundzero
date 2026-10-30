"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { DocsNav } from "@/lib/docs";
import { PixelIcon } from "../pixel-icon";
import { cn } from "../ui";

function NavList({ nav, pathname, onNavigate }: { nav: DocsNav; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-7">
      {nav.map((section) => (
        <div key={section.title} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-3 font-pixel text-xs uppercase tracking-[0.08em] text-muted">
            <PixelIcon name={section.icon} size={11} />
            {section.title}
          </div>
          <ul className="flex flex-col">
            {section.pages.map((page) => {
              const active = page.href === pathname;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-[15px] transition",
                      active
                        ? "lip bg-foreground font-semibold text-background"
                        : "text-foreground/75 hover:bg-surface-secondary hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Left rail on wide screens; a "Menu" disclosure above the page on narrow ones. */
export function DocsSidebar({ nav }: { nav: DocsNav }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = nav.flatMap((s) => s.pages).find((p) => p.href === pathname);

  return (
    <>
      <aside className="sticky top-18 hidden h-[calc(100dvh-4.5rem)] overflow-y-auto py-10 pr-4 [scrollbar-width:thin] lg:block">
        <NavList nav={nav} pathname={pathname} />
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-6 flex w-full items-center gap-2 rounded-xl border-2 border-border bg-surface px-4 py-3 text-left font-semibold shadow-block-sm"
        >
          <PixelIcon name="list" size={14} className="text-muted" />
          <span className="truncate">{current?.title ?? "Docs"}</span>
          <PixelIcon name={open ? "arrow-up" : "arrow-down"} size={10} className="ml-auto text-muted" />
        </button>
        {open && (
          <div className="mt-2 rounded-xl border-2 border-border bg-surface p-3 shadow-block">
            <NavList nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
}
