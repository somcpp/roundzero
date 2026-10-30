"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A Link that prefetches the whole page, data included, once someone points
 * at it, focuses it or touches it, so the click usually lands on a ready page.
 * A plain Link only prefetches our dynamic pages as far as their loading.tsx.
 * Fully prefetched pages are kept for staleTimes.static (next.config.ts).
 */
export function IntentLink({ prefetch, onMouseEnter, onFocus, onTouchStart, ...rest }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...rest}
      prefetch={intent && prefetch !== false ? true : prefetch}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        setIntent(true);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        setIntent(true);
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        setIntent(true);
      }}
    />
  );
}
