import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/** A group of related components, e.g. "Forms". Anchored for the sidebar. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-8 flex-col gap-6">
      <h2 className="border-b border-border pb-3 text-2xl">{title}</h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** One HeroUI component. `name` is the export name, e.g. "Button". */
export function Demo({
  name,
  hint,
  children,
  className,
}: {
  name: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={`c-${name}`} className="scroll-mt-8 overflow-hidden rounded-xl border border-border">
      <div className="flex items-baseline gap-3 border-b border-border bg-surface-secondary/50 px-4 py-2.5">
        <code className="font-mono text-sm font-medium">{name}</code>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className={cn("flex flex-wrap items-start gap-4 bg-background p-6", className)}>{children}</div>
    </div>
  );
}
