"use client";

import { useState } from "react";
import { PixelIcon } from "../pixel-icon";
import { cn } from "../ui";

/** Copies `text` and flips to a check for a moment. Sits in a code block's corner. */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy code"}
      title={copied ? "Copied" : "Copy"}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        "grid size-8 place-items-center rounded-md border-2 border-border bg-surface text-muted transition hover:text-foreground active:translate-y-px",
        className,
      )}
    >
      <PixelIcon name={copied ? "check" : "copy"} size={12} />
    </button>
  );
}
