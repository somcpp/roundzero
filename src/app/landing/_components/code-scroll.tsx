"use client";

import type { ReactNode } from "react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

export function CodeScroll({ children }: { children: ReactNode }) {
  return <SimpleBar autoHide={false}>{children}</SimpleBar>;
}
