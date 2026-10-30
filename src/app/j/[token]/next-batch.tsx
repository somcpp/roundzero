"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { PixelIcon } from "@/components/pixel-icon";
import { Panel } from "@/components/ui";
import { pullNextBatch } from "@/lib/judge-portal-actions";

/** Daily batches, once today's are done: when the next batch opens, and the option to start it now. */
export function NextBatch({ token, count, opensAt }: { token: string; count: number; opensAt: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [going, setGoing] = useState(false);

  const pull = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await pullNextBatch(token);
      if ("error" in result) return setError(result.error);
      setGoing(true);
      router.push(`/j/${token}?p=${result.next}`);
    });

  return (
    <Panel className="flex flex-col items-center gap-4 px-6 py-7 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
        <PixelIcon name="calendar" size={16} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl leading-none">
          {count === 1 ? "1 more project is" : `${count} more projects are`} waiting
        </h2>
        <p className="text-sm text-muted">
          {opensAt ? (
            <>
              Your next batch opens <When iso={opensAt} />. Come back to this link then, or keep going now if you have
              time.
            </>
          ) : (
            "Keep going now if you have time."
          )}
        </p>
      </div>
      <Button onPress={pull} isDisabled={pending || going}>
        {pending || going ? "Opening…" : `Judge ${count} more now`}
        {!(pending || going) && <PixelIcon name="arrow-right" size={12} />}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Panel>
  );
}

/** A time in the judge's own timezone, e.g. "Tue, Oct 7, 9:00 AM". */
function When({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning className="font-medium text-foreground">
      {d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
    </time>
  );
}
