"use client";

import { useState } from "react";
import { PixelIcon } from "@/components/pixel-icon";

/** Copies the winners page link, falling back to the native share sheet where there's no clipboard. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.share?.({ title, url }).catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
    >
      {copied ? "Link copied" : "Share"} <PixelIcon name={copied ? "check" : "external"} size={10} />
    </button>
  );
}
