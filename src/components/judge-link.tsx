"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { PixelIcon } from "./pixel-icon";
import { cn } from "./ui";

/** A judge's private page, /j/<token>. */
export const judgeLinkPath = (token: string) => `/j/${token}`;

/** Copy text to the clipboard and say so for a moment. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
}

/** Copy and open buttons for a judge's private link. */
export function JudgeLinkButtons({ token, name, className }: { token: string; name: string; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={`Copy ${name}'s judge link`}
        onPress={() => copy(new URL(judgeLinkPath(token), window.location.origin).href)}
      >
        <PixelIcon name={copied ? "check" : "copy"} size={12} />
      </Button>
      <a
        href={judgeLinkPath(token)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${name}'s judge page`}
        title="Open their judge page"
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-secondary hover:text-foreground"
      >
        <PixelIcon name="external" size={12} />
      </a>
    </span>
  );
}

/** The judge's full link in a box, with copy and open. */
export function JudgeLinkField({ token, name }: { token: string; name: string }) {
  const { copied, copy } = useCopy();
  const path = judgeLinkPath(token);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border-2 border-border bg-surface-secondary px-3 py-2 font-mono text-sm">
        {path}
      </code>
      <Button
        isIconOnly
        size="sm"
        variant="secondary"
        aria-label={`Copy ${name}'s judge link`}
        onPress={() => copy(new URL(path, window.location.origin).href)}
      >
        <PixelIcon name={copied ? "check" : "copy"} size={12} />
      </Button>
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${name}'s judge page`}
        className="grid size-9 place-items-center rounded-lg border-2 border-border text-muted transition hover:border-accent hover:text-foreground"
      >
        <PixelIcon name="external" size={12} />
      </a>
    </div>
  );
}
