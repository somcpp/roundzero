"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { runAgentOnUnreviewed } from "@/lib/agent-actions";
import { closeJudgingPhase, resetJudging, simulateJudging, startJudging } from "@/lib/judging-actions";
import { addSampleData } from "@/lib/sample-data-actions";

/** A button that runs a server action and shows its error inline. Off in read-only views. */
function ActionButton({
  run,
  pendingLabel,
  variant = "primary",
  size,
  children,
}: {
  run: () => Promise<{ error: string } | object>;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size={size}
        isDisabled={readOnly || pending}
        onPress={() =>
          start(async () => {
            setError(undefined);
            const result = await run();
            if ("error" in result) setError(result.error);
          })
        }
      >
        {pending ? pendingLabel : children}
      </Button>
      {error && (
        <span role="alert" className="max-w-xs text-right text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

export function StartJudgingButton({ slug, disabled }: { slug: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <Button isDisabled>
        Start judging <PixelIcon name="arrow-right" size={12} />
      </Button>
    );
  }
  return (
    <ActionButton run={() => startJudging(slug)} pendingLabel="Starting…">
      Start judging <PixelIcon name="arrow-right" size={12} />
    </ActionButton>
  );
}

export function SampleDataButton({ slug }: { slug: string }) {
  return (
    <ActionButton run={() => addSampleData(slug)} pendingLabel="Adding…" variant="secondary" size="sm">
      <PixelIcon name="plus" size={10} /> Add sample data
    </ActionButton>
  );
}

/** Review every active project the agent hasn't, and pick up anything already queued. */
export function RunAgentButton({ slug, working }: { slug: string; working: boolean }) {
  return (
    <ActionButton run={() => runAgentOnUnreviewed(slug)} pendingLabel="Starting…" variant="secondary">
      <PixelIcon name="spark" size={12} /> {working ? "Agent working · add more" : "Run agent"}
    </ActionButton>
  );
}

export function SimulateButton({ slug }: { slug: string }) {
  return (
    <ActionButton run={() => simulateJudging(slug)} pendingLabel="Simulating…" variant="secondary">
      <PixelIcon name="spark" size={12} /> Simulate activity
    </ActionButton>
  );
}

export function ClosePhaseButton({ slug, title, description }: { slug: string; title: string; description: string }) {
  return (
    <ConfirmButton
      variant="primary"
      size="md"
      title={title}
      description={description}
      confirmLabel="Close phase"
      pendingLabel="Closing…"
      onConfirm={async () => {
        const result = await closeJudgingPhase(slug);
        if ("error" in result) return result.error;
      }}
    >
      Close phase <PixelIcon name="arrow-right" size={12} />
    </ConfirmButton>
  );
}

export function ResetJudgingButton({ slug }: { slug: string }) {
  return (
    <ConfirmButton
      title="Reset judging?"
      description="All assignments, judge scores and agent reviews are deleted, and every project goes back to no phase. Disqualifications and audit trails are kept."
      confirmLabel="Reset judging"
      pendingLabel="Resetting…"
      onConfirm={async () => {
        const result = await resetJudging(slug);
        if ("error" in result) return result.error;
      }}
    >
      Reset judging
    </ConfirmButton>
  );
}
