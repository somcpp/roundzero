"use client";

import { useEffect } from "react";

/**
 * Drawers, menus and dialogs portal to <body>, outside the page's `.brand`
 * wrapper, so they'd fall back to the app's accent. This brands <body> too
 * while the page is mounted, so overlays match the hackathon's color.
 */
export function BrandScope({ color }: { color: string }) {
  useEffect(() => {
    const body = document.body;
    body.classList.add("brand");
    body.style.setProperty("--brand", color);
    return () => {
      body.classList.remove("brand");
      body.style.removeProperty("--brand");
    };
  }, [color]);
  return null;
}
