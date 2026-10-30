import { Badge, type Tone } from "@/components/ui";
import type { ProjectStatus } from "@/lib/data";

export const STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  active: { label: "in the running", tone: "accent" },
  eliminated: { label: "eliminated", tone: "neutral" },
  disqualified: { label: "disqualified", tone: "danger" },
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge tone={STATUS[status].tone} dot={status === "active"} className={className}>
      {STATUS[status].label}
    </Badge>
  );
}
