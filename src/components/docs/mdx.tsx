import Link from "next/link";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import type { IconName } from "@/lib/data";
import { PixelIcon } from "../pixel-icon";
import { Badge, cn, type Tone } from "../ui";
import { CodeBlock } from "./code-block";

// Markdown elements, restyled to match the app. Headings get anchor links
// (ids come from rehype-slug) so the "On this page" list can point at them.

function heading(Tag: "h2" | "h3" | "h4", className: string) {
  return function Heading({ id, children }: ComponentProps<"h2">) {
    return (
      <Tag id={id} className={cn("group scroll-mt-24", className)}>
        {children}
        {id && (
          <a
            href={`#${id}`}
            aria-label="Link to this section"
            className="ml-2 inline-block text-border-secondary opacity-0 transition group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
          >
            #
          </a>
        )}
      </Tag>
    );
  };
}

function Anchor({ href = "", children, ...rest }: ComponentProps<"a">) {
  const className = "font-medium text-accent underline decoration-accent/30 underline-offset-4 transition hover:decoration-accent";
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} {...rest}>
      {children}
    </a>
  );
}

/** Fenced code arrives as <pre><code class="language-x">…</code></pre>; hand it to the highlighter. */
function Pre({ children }: ComponentProps<"pre">) {
  if (isValidElement<{ className?: string; children?: ReactNode }>(children) && typeof children.props.children === "string") {
    const lang = /language-(\S+)/.exec(children.props.className ?? "")?.[1];
    return <CodeBlock code={children.props.children.replace(/\n$/, "")} lang={lang} />;
  }
  return <pre className="my-6 overflow-x-auto rounded-xl border-2 border-border bg-surface p-4 text-sm">{children}</pre>;
}

const elements: MDXComponents = {
  h2: heading("h2", "mt-12 mb-4 text-2xl leading-tight first:mt-0"),
  h3: heading("h3", "mt-9 mb-3 text-lg leading-snug"),
  h4: heading("h4", "mt-6 mb-2 text-base"),
  p: (props) => <p className="my-4 leading-7 text-foreground/85" {...props} />,
  a: Anchor,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  ul: (props) => <ul className="my-4 flex list-disc flex-col gap-2 pl-6 leading-7 text-foreground/85 marker:text-border-secondary" {...props} />,
  ol: (props) => <ol className="my-4 flex list-decimal flex-col gap-2 pl-6 leading-7 text-foreground/85 marker:font-pixel marker:text-muted" {...props} />,
  li: (props) => <li className="pl-1 [&>ol]:my-2 [&>p]:my-0 [&>ul]:my-2" {...props} />,
  hr: () => <hr className="my-10 border-t-2 border-dashed border-border" />,
  blockquote: (props) => <blockquote className="my-6 border-l-4 border-border pl-4 text-muted [&>p]:text-muted" {...props} />,
  code: (props) => (
    <code className="rounded-md border border-border bg-surface-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground" {...props} />
  ),
  pre: Pre,
  table: (props) => (
    <div className="my-6 overflow-x-auto rounded-xl border-2 border-border bg-surface shadow-block-sm">
      <table className="w-full border-collapse text-left text-[15px]" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-surface-secondary" {...props} />,
  th: (props) => <th className="border-b-2 border-border px-4 py-2.5 font-semibold whitespace-nowrap" {...props} />,
  td: (props) => <td className="border-t border-border px-4 py-2.5 align-top text-foreground/85 [&_code]:whitespace-nowrap" {...props} />,
  img: ({ alt, ...props }) => (
    // Docs screenshots live in /public and are already sized for the page.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ""} className="my-6 w-full rounded-xl border-2 border-border shadow-block" {...props} />
  ),
};

// ── Custom components, usable in any .mdx file without an import ──────────

const CALLOUTS = {
  note: { icon: "notebook", label: "Note", className: "border-border bg-surface", iconClass: "text-muted" },
  tip: { icon: "spark", label: "Tip", className: "border-accent/30 bg-accent-soft", iconClass: "text-accent" },
  warning: { icon: "flag", label: "Heads up", className: "border-warning/40 bg-warning-soft", iconClass: "text-warning" },
} satisfies Record<string, { icon: IconName; label: string; className: string; iconClass: string }>;

/** A boxed aside. `type` is note (default), tip or warning. */
export function Callout({ type = "note", title, children }: { type?: keyof typeof CALLOUTS; title?: ReactNode; children: ReactNode }) {
  const c = CALLOUTS[type];
  return (
    <aside className={cn("my-6 flex gap-3 rounded-xl border-2 px-4 py-3.5", c.className)}>
      <PixelIcon name={c.icon} size={14} className={cn("mt-1.5", c.iconClass)} />
      <div className="min-w-0 flex-1 leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-2">
        <div className="font-semibold">{title ?? c.label}</div>
        {children}
      </div>
    </aside>
  );
}

/** Numbered walkthrough: each `###` heading inside becomes a numbered step. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "my-6 ml-4 border-l-2 border-dashed border-border pl-8 [counter-reset:step]",
        "[&>h3]:relative [&>h3]:mt-8 [&>h3]:first:mt-0 [&>h3]:[counter-increment:step]",
        "[&>h3]:before:absolute [&>h3]:before:top-1/2 [&>h3]:before:-left-[3.05rem] [&>h3]:before:grid [&>h3]:before:size-8 [&>h3]:before:-translate-y-1/2 [&>h3]:before:place-items-center [&>h3]:before:rounded-lg [&>h3]:before:bg-foreground [&>h3]:before:font-pixel [&>h3]:before:text-sm [&>h3]:before:text-background [&>h3]:before:shadow-[var(--lip)] [&>h3]:before:content-[counter(step)]",
      )}
    >
      {children}
    </div>
  );
}

const ACCESS: Record<string, { label: string; tone: Tone; icon: IconName }> = {
  organizer: { label: "Signed-in organizers", tone: "accent", icon: "lock" },
  judge: { label: "Judges, via their private link", tone: "warning", icon: "eye" },
  submitter: { label: "Anyone with the form link", tone: "success", icon: "link" },
  public: { label: "Public", tone: "success", icon: "globe" },
  api: { label: "API key or form token", tone: "neutral", icon: "code" },
};

/**
 * The header card for a page of the app: its URL, who can open it, and where
 * it sits in the navigation. Put it at the top of every app page's doc.
 */
export function PageInfo({ path, access, nav }: { path: string; access: keyof typeof ACCESS; nav?: string }) {
  const a = ACCESS[access];
  return (
    <div className="my-6 grid gap-x-6 gap-y-3 rounded-xl border-2 border-border bg-surface px-4 py-3.5 text-sm shadow-block-sm sm:grid-cols-[auto_1fr]">
      <span className="font-pixel text-xs uppercase tracking-[0.08em] text-muted sm:pt-1">URL</span>
      <code className="w-fit rounded-md bg-surface-secondary px-2 py-1 font-mono text-[13px] break-all">{path}</code>
      <span className="font-pixel text-xs uppercase tracking-[0.08em] text-muted sm:pt-1">Who</span>
      <span>
        <Badge tone={a.tone}>
          <PixelIcon name={a.icon} size={10} />
          {a.label}
        </Badge>
      </span>
      {nav && (
        <>
          <span className="font-pixel text-xs uppercase tracking-[0.08em] text-muted sm:pt-1">Find it</span>
          <span className="text-foreground/85">{nav}</span>
        </>
      )}
    </div>
  );
}

/** A grid of link cards, e.g. the pages in a section. */
export function Cards({ children }: { children: ReactNode }) {
  return <div className="my-6 grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function Card({ href, title, icon, children }: { href: string; title: ReactNode; icon?: IconName; children?: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl border-2 border-border bg-surface p-4 shadow-block-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-block active:translate-y-0"
    >
      {icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <PixelIcon name={icon} size={14} />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {title}
          <PixelIcon name="arrow-right" size={10} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </span>
        {children && <span className="text-sm leading-6 text-muted">{children}</span>}
      </span>
    </Link>
  );
}

/** Keyboard key, e.g. <Kbd>⌘K</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-b-[3px] border-border bg-surface px-1.5 py-0.5 font-mono text-[0.8em] font-semibold">
      {children}
    </kbd>
  );
}

export const docsMdxComponents: MDXComponents = {
  ...elements,
  Callout,
  Steps,
  PageInfo,
  Cards,
  Card,
  Kbd,
};
