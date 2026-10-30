import type { ReactNode } from "react";

/* Framing guides on the top-left and bottom-right corners. */
export function CornerMarks({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`corner-marks ${className}`.trim()}>{children}</div>;
}
