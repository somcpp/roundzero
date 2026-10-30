"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** How long to keep refreshing after the work ends: the last writes (audit trail, write-up) land just after. */
const TRAIL_MS = 15_000;

/**
 * While `active`, re-render the page from the server every few seconds so
 * background work (the agent reviewing projects) shows up as it happens.
 * Keeps going briefly after it stops, and pauses while the tab is hidden.
 */
export function LiveRefresh({ active, every = 2500 }: { active: boolean; every?: number }) {
  const router = useRouter();
  const wasActive = useRef(active);
  const [trailing, setTrailing] = useState(false);

  useEffect(() => {
    if (wasActive.current && !active) {
      setTrailing(true);
      const t = setTimeout(() => setTrailing(false), TRAIL_MS);
      wasActive.current = active;
      return () => clearTimeout(t);
    }
    wasActive.current = active;
  }, [active]);

  const polling = active || trailing;
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(id);
  }, [polling, every, router]);
  return null;
}
