"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { TextArea } from "@/components/controls";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { RubricField, sameScores, weightedTotal, type RubricScores } from "@/components/rubric";
import { Panel, cn } from "@/components/ui";
import type { PortalCriterion, PortalCurrent } from "@/lib/judge-portal";
import { submitPortalScore } from "@/lib/judge-portal-actions";

/**
 * The judge's rubric for the project they have open. Submitting moves on to
 * the next project, unless the hackathon shows the agent's scores: then they
 * appear next to the judge's, and the judge can change their score once.
 */
export function JudgeRail({
  token,
  current,
  criteria,
  showAgentScore,
  nextHref,
  isLast,
}: {
  token: string;
  current: PortalCurrent;
  criteria: PortalCriterion[];
  showAgentScore: boolean;
  /** Where to go once this one's done: the next unscored project, or the overview. */
  nextHref: string;
  /** Nothing else is waiting after this one. */
  isLast: boolean;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<RubricScores>(current.scores);
  const [notes, setNotes] = useState(current.notes);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // Submitted and on the way somewhere: hold the buttons until the page catches up.
  const [sent, setSent] = useState(false);

  const submitted = !!current.submittedAt;
  const agent = current.agent;
  const final = !!agent && !!current.adjustedAt;
  const missing = criteria.filter((c) => scores[c.id] === undefined).length;
  const total = weightedTotal(criteria, scores);
  const dirty = !sameScores(scores, current.scores) || notes.trim() !== current.notes;
  // The first submit will show the agent's scores.
  const reveals = showAgentScore && current.agentReady && !submitted;
  const busy = pending || (sent && !submitted);

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await submitPortalScore(token, current.id, scores, notes);
      if ("error" in result) return setError(result.error);
      setSent(true);
      // Stay to see the agent's scores; otherwise on to the next one.
      if (!submitted && result.agentReady) router.refresh();
      else router.push(nextHref);
    });

  const onward = isLast ? "finish" : "next";
  let action: { label: string; onPress: () => void; disabled?: boolean };
  if (!submitted) {
    action = {
      label: reveals ? "Submit & see the agent's" : `Submit & ${onward}`,
      onPress: save,
      disabled: missing > 0,
    };
  } else if (dirty && !final) {
    action = { label: `Save change & ${onward}`, onPress: save, disabled: missing > 0 };
  } else {
    action = { label: isLast ? "Finish" : "Next project", onPress: () => router.push(nextHref) };
  }

  return (
    <Panel className="flex flex-col gap-6 p-6">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg leading-none">Your scores</h2>
          <span className="text-xs text-muted">{submitted ? "Submitted" : "Not submitted yet"}</span>
        </div>
        <span className={cn("font-pixel text-4xl leading-none", total === null && "text-muted")}>
          {total === null ? "–" : total.toFixed(1)}
        </span>
      </div>

      {agent &&
        (final ? (
          <p className="flex items-start gap-2.5 rounded-lg border border-dashed border-border-secondary px-3.5 py-3 text-xs text-muted">
            <PixelIcon name="lock" size={12} className="mt-0.5 shrink-0" />
            You changed this score after seeing the agent&apos;s, so it&apos;s final.
          </p>
        ) : (
          <p className="flex items-start gap-2.5 rounded-lg bg-accent-soft px-3.5 py-3 text-xs text-accent-soft-foreground">
            <PixelIcon name="eye" size={12} className="mt-0.5 shrink-0" />
            <span>
              The agent&apos;s scores are showing
              {agent.total !== null && (
                <>
                  {" "}
                  (<b className="font-pixel">{agent.total.toFixed(1)}</b> overall)
                </>
              )}
              . If you disagree, change yours and save. You can change it once.
            </span>
          </p>
        ))}

      <SaveError error={error} />

      <fieldset disabled={final || busy} className="flex flex-col gap-5 disabled:opacity-60">
        {criteria.map((c) => (
          <RubricField
            key={c.id}
            criterion={c}
            value={scores[c.id]}
            agent={agent?.scores[c.id]}
            onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))}
          />
        ))}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Notes</span>
          <TextArea
            rows={4}
            maxLength={4000}
            value={notes}
            placeholder="What stood out? Why this score?"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth isDisabled={busy || action.disabled} onPress={action.onPress}>
          {busy ? "Saving…" : action.label}
          {!busy && <PixelIcon name="arrow-right" size={12} />}
        </Button>
        <span className="text-center text-xs text-muted" aria-live="polite">
          {!submitted
            ? missing > 0
              ? `Score every criterion to submit (${missing} left)`
              : reveals
                ? "Then you'll see the agent's scores, and can change yours once."
                : "Your score saves when you submit."
            : agent
              ? final
                ? "Thanks! This one's done."
                : "You can change your score once."
              : "You can change it until this round closes."}
        </span>
      </div>
    </Panel>
  );
}
