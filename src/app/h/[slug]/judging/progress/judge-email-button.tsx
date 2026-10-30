"use client";

import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { emailJudgeLink } from "@/lib/email-actions";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Email one judge their private link and queue for the running phase again,
 * e.g. when they can't find the first one. `sentAt` is when their invite for
 * this phase last went out.
 */
export function JudgeEmailButton({
  slug,
  judgeId,
  email,
  sentAt,
}: {
  slug: string;
  judgeId: string;
  email: string;
  sentAt: string | null;
}) {
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  if (!email) {
    return (
      <span className="text-xs text-muted" title="Add an email in Setup › Judges to send their link">
        no email
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className={note && !note.ok ? "max-w-48 text-xs text-danger" : "hidden text-xs text-muted lg:inline"}>
        {note?.text ?? (sentAt ? `emailed ${day(sentAt)}` : "not emailed")}
      </span>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={`Email ${email} their judge link`}
        isDisabled={readOnly || pending}
        onPress={() =>
          start(async () => {
            const result = await emailJudgeLink(slug, judgeId);
            setNote("error" in result ? { ok: false, text: result.error } : { ok: true, text: "sending…" });
          })
        }
      >
        <PixelIcon name={note?.ok ? "check" : "mail"} size={12} />
      </Button>
    </span>
  );
}
