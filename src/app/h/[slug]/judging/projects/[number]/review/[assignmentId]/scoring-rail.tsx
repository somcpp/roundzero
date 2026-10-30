"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { TextArea } from "@/components/controls";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { RubricField, sameScores, weightedTotal, type RubricScores } from "@/components/rubric";
import { Panel, cn } from "@/components/ui";
import type { Criterion } from "@/lib/data";
import { removeAdminScore, submitAdminScore, submitJudgeScore } from "@/lib/review-actions";
import type { ProjectReview } from "@/lib/reviews";
import { LocalTime } from "../../project-controls";

/**
 * The rubric: one control per criterion, notes, and submit. Either a judge's
 * review entered on their behalf, or (`own`) the signed-in admin's own review,
 * which adds one more score to the phase.
 */
export function ScoringRail({
  review,
  criteria,
  slug,
  projectHref,
  own = false,
}: {
  review: ProjectReview;
  criteria: Criterion[];
  slug: string;
  projectHref: string;
  own?: boolean;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<RubricScores>(review.scores);
  const [notes, setNotes] = useState(review.notes);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const readOnly = useReadOnly();

  const locked = !review.phase.running;
  const missing = criteria.filter((c) => scores[c.id] === undefined);
  // Scores entered before per-criterion scoring (the demo) only have a total.
  const total = weightedTotal(criteria, scores) ?? review.total;
  const dirty = !sameScores(scores, review.scores) || notes.trim() !== review.notes;

  const set = (id: string, v: number | boolean) => {
    setScores((s) => ({ ...s, [id]: v }));
    setSaved(null);
  };

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const result = own
        ? await submitAdminScore(slug, review.projectId, scores, notes)
        : await submitJudgeScore(slug, review.id, scores, notes);
      if ("error" in result) return setError(result.error);
      setSaved(result.total);
      router.refresh();
    });

  const heading = own ? "Your scores" : `${review.judge?.name.split(" ")[0] ?? "Judge"}'s scores`;

  return (
    <Panel className="flex flex-col gap-6 p-6">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg leading-none">{heading}</h2>
          <span className="text-xs text-muted">
            {review.submittedAt ? (
              <>
                Submitted <LocalTime iso={review.submittedAt} />
              </>
            ) : (
              "Not submitted yet"
            )}
          </span>
        </div>
        <span className={cn("font-pixel text-4xl leading-none", total === null && "text-muted")}>
          {total === null ? "–" : total.toFixed(1)}
        </span>
      </div>

      <SaveError error={error} />

      {locked && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-border-secondary px-3.5 py-3 text-xs text-muted">
          <PixelIcon name="lock" size={12} className="mt-0.5 shrink-0" />
          {review.phase.name} isn&apos;t running, so these scores are locked.
        </p>
      )}

      <fieldset disabled={locked || pending} className="flex flex-col gap-5 disabled:opacity-60">
        {criteria.map((c) => (
          <RubricField key={c.id} criterion={c} value={scores[c.id]} onChange={(v) => set(c.id, v)} />
        ))}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Notes</span>
          <TextArea
            rows={4}
            maxLength={4000}
            value={notes}
            placeholder="What stood out? Why this score?"
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(null);
            }}
          />
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth isDisabled={locked || readOnly || pending || missing.length > 0 || !dirty} onPress={submit}>
          {pending ? "Submitting…" : review.submittedAt ? "Update score" : own ? "Add my score" : "Submit score"}
          {!pending && <PixelIcon name="arrow-right" size={12} />}
        </Button>
        <span className="text-center text-xs text-muted" aria-live="polite">
          {saved !== null ? (
            <span className="text-success-soft-foreground">
              Saved {saved.toFixed(1)} and logged to the{" "}
              <Link href={projectHref} className="underline underline-offset-4">
                audit trail
              </Link>
              .
            </span>
          ) : missing.length > 0 && !locked ? (
            `Score every criterion to submit (${missing.length} left)`
          ) : review.submittedAt && !dirty ? (
            "No changes since the last submit"
          ) : own ? (
            `Counts as one more score in ${review.phase.name}, next to the judges'`
          ) : (
            "Logged to the audit trail with your user id"
          )}
        </span>
        {own && review.submittedAt && !locked && (
          <ConfirmButton
            variant="ghost"
            size="sm"
            className="self-center text-muted hover:bg-danger-soft hover:text-danger"
            title="Remove your score?"
            description={`Your score comes out of ${review.phase.name}'s average. The judges' scores stay, and the audit trail keeps a record.`}
            confirmLabel="Remove my score"
            pendingLabel="Removing…"
            onConfirm={async () => {
              const result = await removeAdminScore(slug, review.projectId);
              if ("error" in result) return result.error;
              router.push(projectHref);
            }}
          >
            Remove my score
          </ConfirmButton>
        )}
      </div>
    </Panel>
  );
}
