import type { ReactNode } from "react";
import { PixelIcon } from "./pixel-icon";

/** Why part of a page is read-only, like setup once judging has started. */
export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-dashed border-border-secondary px-3.5 py-3 text-sm text-muted">
      <PixelIcon name="lock" size={12} className="mt-1 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
