"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "../ui";

type Heading = { id: string; text: string; level: 2 | 3 };

const SELECTOR = "#doc-content :is(h2, h3)[id]";
const NONE: Heading[] = [];
let cached: { key: string; headings: Heading[] } = { key: "", headings: NONE };

// The rendered doc is the source of truth: its headings carry the ids rehype-slug gave them.
function readHeadings(): Heading[] {
  const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  const key = els.map((el) => el.id).join(" ");
  if (key !== cached.key) {
    cached = {
      key,
      // The trailing "#" anchor is part of the heading's text; drop it.
      headings: els.map((el) => ({ id: el.id, text: el.textContent?.replace(/#$/, "").trim() ?? "", level: el.tagName === "H2" ? 2 : 3 })),
    };
  }
  return cached.headings;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.getElementById("doc-content") ?? document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** "On this page": the h2/h3s of the doc in #doc-content, highlighting the one you're reading. */
export function DocsToc() {
  const headings = useSyncExternalStore(subscribe, readHeadings, () => NONE);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => !!el);
    // The active heading is the last one scrolled past the top quarter of the viewport.
    const observer = new IntersectionObserver(
      () => {
        const passed = els.filter((el) => el.getBoundingClientRect().top < window.innerHeight * 0.25);
        setActive(passed.at(-1)?.id ?? null);
      },
      { rootMargin: "0px 0px -75% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;
  const current = active && headings.some((h) => h.id === active) ? active : headings[0].id;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-2 text-sm">
      <div className="font-pixel text-xs uppercase tracking-[0.08em] text-muted">On this page</div>
      <ul className="flex flex-col border-l-2 border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={cn(
                "-ml-0.5 block border-l-2 py-1 transition",
                h.level === 3 ? "pl-6" : "pl-3",
                current === h.id ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
