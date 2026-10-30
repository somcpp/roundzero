"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Lets every motion reveal on the page honor the visitor's reduced-motion setting. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
