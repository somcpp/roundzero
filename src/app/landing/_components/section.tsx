"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { CodeScroll } from "./code-scroll";
import { CornerMarks } from "./corner-marks";
import { highlight } from "./highlight";

/* Shared in-view reveal settings — animate once, just before fully on-screen. */
const VIEWPORT = { once: true, margin: "-80px" } as const;

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT,
  transition: { duration: 0.45, delay, ease: [0.22, 0.8, 0.2, 1] as const },
});

/** Fades its children up the first time they scroll into view. */
export function Reveal({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} {...rise(delay)}>
      {children}
    </motion.div>
  );
}

/*
 * A page section: a large headline and subheadline for the main idea, then
 * whatever shows it off underneath. `aside` sits at the headline's right on
 * wide screens (a docs link, say) and drops below it on narrow ones.
 */
export function Section({
  id,
  headline,
  subheadline,
  aside,
  center = false,
  className = "",
  children,
}: {
  id: string;
  headline: ReactNode;
  subheadline?: ReactNode;
  aside?: ReactNode;
  center?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl scroll-mt-28 px-6 py-24 ${className}`.trim()}>
      <motion.div
        className={center ? "mx-auto max-w-3xl text-center" : "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-10"}
        {...rise()}
      >
        <div className={center ? "" : "max-w-3xl"}>
          <h2 className="m-0 text-4xl leading-[1.05] tracking-wide text-pretty sm:text-6xl">{headline}</h2>
          {subheadline ? (
            <p className={`m-0 mt-6 max-w-2xl text-xl leading-relaxed text-pretty text-[var(--muted)] ${center ? "mx-auto" : ""}`}>
              {subheadline}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0 sm:pb-1.5">{aside}</div> : null}
      </motion.div>
      {children}
    </section>
  );
}

/** A 32px icon tile, a bold title and a line or two of muted text: the page's list row. */
export function IconRow({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--violet-soft)] text-[var(--violet)]">{icon}</span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-[var(--silver)]">{title}</span>
        <span className="leading-relaxed text-[var(--muted)]">{children}</span>
      </span>
    </li>
  );
}

/* A tinted card: title and description beside a mock of the product. */
export function Showcase({
  title,
  description,
  media,
  flip = false,
}: {
  title: ReactNode;
  description: ReactNode;
  media: ReactNode;
  /** Put the media on the left. */
  flip?: boolean;
}) {
  return (
    <motion.div className="tint-card mt-14 overflow-hidden" {...rise(0.08)}>
      <div className={`grid items-center gap-10 ${flip ? "lg:grid-cols-[7fr_5fr]" : "lg:grid-cols-[5fr_7fr]"}`}>
        <div className={`min-w-0 px-7 pt-10 sm:px-12 sm:pt-14 lg:pb-14 ${flip ? "lg:order-2 lg:pl-0" : ""}`}>
          <h3 className="m-0 text-3xl leading-tight tracking-wide text-pretty sm:text-4xl">{title}</h3>
          <div className="m-0 mt-6 text-base leading-relaxed text-[var(--muted)]">{description}</div>
        </div>
        <div className={`min-w-0 px-4 pb-10 sm:px-8 lg:py-12 ${flip ? "lg:order-1 lg:pr-0" : "lg:pl-0"}`}>
          {/* The media follows a beat after the card. */}
          <motion.div className="flex w-full justify-center" {...rise(0.12)}>
            {media}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* A dark code window with the page's tiny highlighter. */
export function CodeWindow({ code }: { code: string }) {
  return (
    <CornerMarks className="corner-marks-soft">
      <div className="code-window">
        <CodeScroll>
          <pre>
            <code>{highlight(code)}</code>
          </pre>
        </CodeScroll>
      </div>
    </CornerMarks>
  );
}
