// Display helpers shared by server queries and client forms.

import type { Stage } from "@/lib/data";

export const STAGES: Stage[] = ["setup", "judging", "results"];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const month = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

/** "Oct 3–5", "Feb 27 – Mar 2", "Mar 14", or "Dates TBD". */
export function formatDates(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "Dates TBD";
  const start = new Date(startsOn ?? endsOn!);
  const end = new Date(endsOn ?? startsOn!);
  const from = `${month(start)} ${start.getUTCDate()}`;
  if (start.getTime() === end.getTime()) return from;
  if (month(start) === month(end) && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${from}–${end.getUTCDate()}`;
  }
  return `${from} – ${month(end)} ${end.getUTCDate()}`;
}
