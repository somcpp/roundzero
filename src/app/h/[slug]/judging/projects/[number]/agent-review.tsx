"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { BlockRating, Segmented, TextArea } from "@/components/controls";
import { EditDrawer } from "@/components/edit-drawer";
import { SaveError } from "@/components/list-editor";
import { LiveRefresh } from "@/components/live-refresh";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { Spinner } from "@/components/shadcn/spinner";
import { Badge, Eyebrow, Panel, Segments, cn } from "@/components/ui";
import { flagAgentStep, overrideAgentStep, rerunAgentStep, runAgentReviews } from "@/lib/agent-actions";
import type { AgentReviewView, AgentStepView } from "@/lib/agent-reviews";
import { MODEL_TIERS, modelName, tierLabel } from "@/lib/agent/tiers";
import { FLAG_LABELS, type TraceEntry } from "@/lib/agent/types";
import { mechanisms as allMechanisms, type Criterion, type IconName, type Mechanism, type ModelTier } from "@/lib/data";
import { LocalTime } from "./project-controls";

type Props = {
  slug: string;
  projectId: string;
  projectName: string;
  review: AgentReviewView | null;
  criteria: Criterion[];
  models: Record<ModelTier, string>;
  /** Why sandbox runs are off, when they are. */
  sandboxOff: string | null;
};

const judgesOnly = (c: Criterion) => c.mechanisms.length > 0 && c.mechanisms.every((m) => m === "human_only");
const busy = (s: { status: string }) => s.status === "queued" || s.status === "running";
const seconds = (from: string | null, to: string | null) =>
  from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000)) : null;
const duration = (s: number | null) => (s === null ? "" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** The step's value as it counts: the override if there is one, else the agent's. */
const effective = (s: AgentStepView) => ({
  score: s.override?.score ?? (s.override ? null : s.score),
  passed: s.override?.passed ?? (s.override ? null : s.passed),
});

/**
 * The agent's review of this project: its total and write-up, then one step
 * per criterion with the score, confidence, reasoning, evidence and how it
 * got there. Admins direct it from here: run it, re-run a step with
 * guidance, flag a step for a person, or override the verdict.
 */
export function AgentReview(props: Props) {
  const { review, criteria } = props;
  const working = review ? busy(review) || review.steps.some(busy) : false;
  const steps = criteria.map((c) => ({ criterion: c, step: review?.steps.find((s) => s.criterionId === c.id) ?? null }));

  return (
    <section id="agent" className="scroll-mt-40">
      <LiveRefresh active={working} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg leading-none">Agent review</h2>
        {review && <ReviewStatus review={review} />}
        <div className="ml-auto">
          <RunReview {...props} working={working} />
        </div>
      </div>

      {!review ? (
        <Panel className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm">
            The agent hasn&apos;t reviewed this project yet. It works through the criteria one at a time with each
            one&apos;s mechanisms, explains every score with evidence, double-checks what it isn&apos;t sure of, and flags
            anything that needs a person.
          </p>
          {props.sandboxOff && criteria.some((c) => c.mechanisms.includes("sandbox_run")) && <SandboxNote reason={props.sandboxOff} />}
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <Summary review={review} />
          {props.sandboxOff && criteria.some((c) => c.mechanisms.includes("sandbox_run")) && <SandboxNote reason={props.sandboxOff} />}
          <ol className="flex flex-col gap-3">
            {steps.map(({ criterion, step }, i) => (
              <StepCard key={criterion.id} index={i} criterion={criterion} step={step} reviewBusy={busy(review)} {...props} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function SandboxNote({ reason }: { reason: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-dashed border-border-secondary px-3.5 py-3 text-xs text-muted">
      <PixelIcon name="gear" size={12} className="mt-0.5 shrink-0" />
      <span>
        Sandbox runs are off: {reason}. The agent still reads and searches the code, but can&apos;t install, build or test
        it. Add your Nebius project id as NEBIUS_PROJECT_ID to turn them on.
      </span>
    </p>
  );
}

function ReviewStatus({ review }: { review: AgentReviewView }) {
  if (review.status === "queued") return <Badge dot>queued</Badge>;
  if (review.status === "running") {
    const done = review.steps.filter((s) => !busy(s)).length;
    return (
      <Badge tone="accent" dot>
        reviewing · {done}/{review.steps.length || "…"}
      </Badge>
    );
  }
  if (review.status === "failed") return <Badge tone="danger">failed</Badge>;
  return review.flagged > 0 ? (
    <Badge tone="warning">
      <PixelIcon name="flag" size={10} /> {review.flagged} need{review.flagged === 1 ? "s" : ""} a person
    </Badge>
  ) : (
    <Badge tone="success">done</Badge>
  );
}

// ── Running the whole review ──────────────────────────────────────────────

const DEFAULT_TIER = "default";
type TierChoice = ModelTier | typeof DEFAULT_TIER;

function RunReview({ slug, projectId, projectName, review, models, working }: Props & { working: boolean }) {
  const [open, setOpen] = useState(false);
  const [guidance, setGuidance] = useState(review?.guidance ?? "");
  const [tier, setTier] = useState<TierChoice>(review?.modelTier ?? DEFAULT_TIER);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const overrides = review?.steps.filter((s) => s.override).length ?? 0;
  const readOnly = useReadOnly();

  const run = async () => {
    setError(undefined);
    const result = await runAgentReviews(slug, [projectId], { guidance, tier: tier === DEFAULT_TIER ? null : tier });
    if ("error" in result) return result.error;
    if (result.queued === 0) return "The agent is already on this project.";
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" variant={review ? "secondary" : "primary"} isDisabled={working} onPress={() => setOpen(true)}>
        {working ? <Spinner className="size-3" /> : <PixelIcon name="spark" size={12} />}
        {working ? "Agent working…" : review ? "Re-run review" : "Run agent review"}
      </Button>
      <EditDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        eyebrow="Agent review"
        title={projectName}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="tertiary" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            {review ? (
              <ConfirmButton
                variant="primary"
                size="md"
                title="Replace the agent's review?"
                description={`Every criterion is judged again from scratch.${
                  overrides ? ` Your overrides on ${overrides} ${overrides === 1 ? "step" : "steps"} are cleared.` : ""
                } The old verdicts stay in the audit trail.`}
                confirmLabel="Re-run review"
                pendingLabel="Queuing…"
                onConfirm={run}
              >
                Re-run review
              </ConfirmButton>
            ) : (
              <Button isDisabled={readOnly || pending} onPress={() => start(async () => setError(await run()))}>
                {pending ? "Queuing…" : "Run agent review"}
              </Button>
            )}
          </div>
        }
      >
        <SaveError error={error} />
        <p className="text-sm text-muted">
          The agent judges every criterion with its mechanisms and settings from Setup › Criteria. Anything you add
          here applies on top, for this run.
        </p>
        <GuidanceField value={guidance} onChange={setGuidance} placeholder="e.g. The team says the SDK calls are in /server. Their demo login is demo@example.com." />
        <TierField value={tier} onChange={setTier} models={models} allowDefault />
      </EditDrawer>
    </>
  );
}

function GuidanceField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex flex-col gap-2">
      <Eyebrow>What should it look at?</Eyebrow>
      <TextArea rows={4} maxLength={4000} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TierField({
  value,
  onChange,
  models,
  allowDefault,
  defaultLabel = "Per criterion",
  defaultHint = "Each criterion uses the model set for it.",
}: {
  value: TierChoice;
  onChange: (v: TierChoice) => void;
  models: Record<ModelTier, string>;
  allowDefault?: boolean;
  defaultLabel?: string;
  defaultHint?: string;
}) {
  const tier = MODEL_TIERS.find((t) => t.id === value);
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Model</Eyebrow>
      <Segmented<TierChoice>
        size="sm"
        value={value}
        onChange={onChange}
        options={[
          ...(allowDefault ? [{ value: DEFAULT_TIER as TierChoice, label: defaultLabel }] : []),
          ...MODEL_TIERS.map((t) => ({ value: t.id as TierChoice, label: t.label })),
        ]}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
      />
      <span className="text-xs text-muted">
        {tier ? (
          <>
            {tier.hint} <span className="font-mono">{modelName(models[tier.id])}</span>
          </>
        ) : (
          defaultHint
        )}
      </span>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────

function Summary({ review }: { review: AgentReviewView }) {
  const took = seconds(review.startedAt, review.finishedAt);
  const used = review.steps.reduce((n, s) => n + (s.usage ? s.usage.inputTokens + s.usage.outputTokens : 0), 0);
  return (
    <Panel className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("font-pixel text-5xl leading-none", review.total === null && "text-muted")}>
            {review.total === null ? "–" : review.total.toFixed(1)}
          </span>
          <span className="font-pixel text-sm text-muted">/10</span>
        </div>
        {review.gateDecision?.decision === "overturned" ? (
          // The agent failed a gate and the agent-failed inbox disagreed.
          <Badge tone="success" title={review.gateDecision.note || "The inbox put it back in the pool"}>
            <PixelIcon name="refresh" size={10} />
            Gate failure overturned
          </Badge>
        ) : (
          review.gatePassed !== null && (
            <Badge tone={review.gatePassed ? "success" : "danger"} title={review.gateDecision?.note || undefined}>
              <PixelIcon name={review.gatePassed ? "check" : "lock"} size={10} />
              {review.gatePassed ? "gates passed" : review.gateDecision ? "gate failed · upheld" : "gate failed"}
            </Badge>
          )
        )}
        <span className="ml-auto text-right text-xs text-muted">
          {review.finishedAt ? (
            <>
              Finished <LocalTime iso={review.finishedAt} />
            </>
          ) : review.startedAt ? (
            <>
              Started <LocalTime iso={review.startedAt} />
            </>
          ) : (
            <>
              Queued <LocalTime iso={review.queuedAt} />
            </>
          )}
          {took !== null && ` · took ${duration(took)}`}
          {review.modelTier && ` · ${tierLabel(review.modelTier)}`}
          {used > 0 && ` · ${tokens(used)} tokens`}
        </span>
      </div>

      {review.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">{review.error}</p>}
      {review.summary ? (
        <p className="text-[15px] leading-relaxed">{review.summary}</p>
      ) : (
        review.status !== "done" && <p className="text-sm text-muted">The write-up comes once every step is done.</p>
      )}

      {(review.strengths.length > 0 || review.improvements.length > 0) && (
        <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <PointList title="Strengths" icon="check" items={review.strengths} tone="text-success" />
          <PointList title="To improve" icon="arrow-up" items={review.improvements} tone="text-accent" />
        </div>
      )}
      {review.guidance && (
        <p className="border-t border-border pt-4 text-xs text-muted">
          <span className="font-pixel uppercase tracking-wide">Your direction for this run:</span> {review.guidance}
        </p>
      )}
    </Panel>
  );
}

function PointList({ title, icon, items, tone }: { title: string; icon: IconName; items: string[]; tone: string }) {
  if (!items.length) return <div />;
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{title}</Eyebrow>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <PixelIcon name={icon} size={10} className={cn("mt-1 shrink-0", tone)} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────

const mechanismInfo = (m: Mechanism) => allMechanisms.find((x) => x.id === m);

function StepCard({
  index,
  criterion: c,
  step,
  reviewBusy,
  slug,
  projectId,
  models,
}: Props & { index: number; criterion: Criterion; step: AgentStepView | null; reviewBusy: boolean }) {
  const [open, setOpen] = useState(Boolean(step?.needsReview));
  const [drawer, setDrawer] = useState<"rerun" | "override" | "flag" | null>(null);
  const skipped = step?.status === "skipped" || (!step && judgesOnly(c));
  const running = step ? busy(step) : false;
  const value = step ? effective(step) : null;
  const firstLine = step?.reasoning.split(/(?<=[.!?])\s/)[0] ?? "";

  const headline = skipped
    ? "Judges only: the agent doesn't score this"
    : !step
      ? reviewBusy
        ? "Waiting"
        : "Not reviewed yet: added after the last run"
      : running
        ? step.activity || (step.status === "queued" ? "Waiting its turn" : "Working")
        : step.status === "failed"
          ? `Couldn't finish: ${step.error ?? "unknown error"}`
          : firstLine;

  return (
    <li>
      <Panel className={cn("overflow-hidden", step?.needsReview && "border-warning/60", running && "border-accent/50")}>
        <button
          type="button"
          onClick={() => step && !skipped && setOpen((o) => !o)}
          aria-expanded={open}
          className={cn("flex w-full items-center gap-4 px-5 py-4 text-left", step && !skipped && "cursor-pointer hover:bg-surface-secondary/50")}
        >
          <span className="w-5 shrink-0 font-pixel text-xs text-muted">{index + 1}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-medium">{c.title}</span>
              <span className="flex items-center gap-1 text-muted">
                {c.mechanisms.map((m) => {
                  const info = mechanismInfo(m);
                  return info ? <PixelIcon key={m} name={info.icon} size={10} aria-label={info.name} /> : null;
                })}
              </span>
              {c.gate && <Badge tone="warning">gate</Badge>}
              {step?.needsReview && (
                <Badge tone="warning">
                  <PixelIcon name="flag" size={10} /> needs a person
                </Badge>
              )}
              {step?.override && <Badge tone="accent">overridden</Badge>}
            </span>
            <span className={cn("flex items-center gap-1.5 truncate text-xs text-muted", step?.status === "failed" && "text-danger")}>
              {running && <Spinner className="size-3 shrink-0 text-accent" />}
              <span className="truncate">{headline}</span>
            </span>
          </span>
          {step?.confidence != null && !running && step.status === "done" && (
            <span className="hidden w-24 shrink-0 flex-col gap-1 sm:flex" title={`Confidence ${step.confidence.toFixed(2)}`}>
              <Segments value={step.confidence * 10} max={10} count={10} tone={step.confidence < 0.6 ? "muted" : "accent"} />
              <span className="text-right font-pixel text-[10px] text-muted">conf {step.confidence.toFixed(2)}</span>
            </span>
          )}
          <span className="w-16 shrink-0 text-right">{value && !skipped && <VerdictValue {...value} scale={c.scale} />}</span>
          {step && !skipped && (
            <PixelIcon name="arrow-down" size={10} className={cn("shrink-0 text-muted transition", open && "rotate-180")} />
          )}
        </button>

        {open && step && !skipped && (
          <StepDetails
            step={step}
            criterion={c}
            reviewBusy={reviewBusy}
            slug={slug}
            onAction={setDrawer}
          />
        )}
      </Panel>

      {step && drawer && (
        <StepDrawer
          mode={drawer}
          onClose={() => setDrawer(null)}
          step={step}
          criterion={c}
          slug={slug}
          projectId={projectId}
          models={models}
        />
      )}
    </li>
  );
}

function VerdictValue({ score, passed, scale }: { score: number | null; passed: boolean | null; scale: Criterion["scale"] }) {
  if (scale === "pass_fail") {
    if (passed === null) return <span className="font-pixel text-muted">–</span>;
    return <Badge tone={passed ? "success" : "danger"}>{passed ? "pass" : "fail"}</Badge>;
  }
  if (score === null) return <span className="font-pixel text-muted">–</span>;
  return (
    <span className="font-pixel text-2xl leading-none">
      {score}
      <span className="text-xs text-muted">/10</span>
    </span>
  );
}

const valueLabel = (v: { score: number | null; passed: boolean | null }) =>
  v.score !== null ? `${v.score}/10` : v.passed === null ? "no verdict" : v.passed ? "pass" : "fail";

function StepDetails({
  step,
  criterion: c,
  reviewBusy,
  slug,
  onAction,
}: {
  step: AgentStepView;
  criterion: Criterion;
  reviewBusy: boolean;
  slug: string;
  onAction: (mode: "rerun" | "override" | "flag") => void;
}) {
  const running = busy(step);
  const took = seconds(step.startedAt, step.finishedAt);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  const resolve = () =>
    start(async () => {
      setError(undefined);
      const r = await flagAgentStep(slug, step.id, false, "");
      if ("error" in r) setError(r.error);
    });

  return (
    <div className="flex flex-col gap-6 border-t border-border px-5 py-5">
      <SaveError error={error} />

      {step.needsReview && (
        <Callout tone="warning" icon="flag" title="Needs a person">
          <p>{step.reviewReason || "Flagged for a second look."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" isDisabled={readOnly || pending || running} onPress={resolve}>
              <PixelIcon name="check" size={10} /> {pending ? "Saving…" : "Looks right"}
            </Button>
            <Button size="sm" variant="secondary" isDisabled={running} onPress={() => onAction("override")}>
              Override…
            </Button>
            <Button size="sm" variant="secondary" isDisabled={running || reviewBusy} onPress={() => onAction("rerun")}>
              Re-run with guidance…
            </Button>
          </div>
        </Callout>
      )}

      {step.override && (
        <Callout tone="accent" icon="user" title={`Overridden to ${valueLabel(step.override)}`}>
          <p>
            The agent said {valueLabel(step)}.{step.override.note && <> Reason: {step.override.note}</>}
          </p>
          {step.resolvedAt && (
            <p className="mt-1 text-xs text-muted">
              <LocalTime iso={step.resolvedAt} />
            </p>
          )}
          <div className="mt-3">
            <ConfirmButton
              size="sm"
              variant="secondary"
              title="Clear the override?"
              description={`The agent's verdict (${valueLabel(step)}) counts again, and the change is logged to the audit trail.`}
              confirmLabel="Clear override"
              pendingLabel="Clearing…"
              onConfirm={async () => {
                const r = await overrideAgentStep(slug, step.id, null, "");
                if ("error" in r) return r.error;
              }}
            >
              Clear override
            </ConfirmButton>
          </div>
        </Callout>
      )}

      {running && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4 text-accent" /> {step.activity || "Working"}
          {step.reasoning && " · the verdict below is from the last run"}
        </p>
      )}

      {step.reasoning && (
        <Block title="Reasoning">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{step.reasoning}</p>
        </Block>
      )}

      {step.evidence.length > 0 && (
        <Block title="Evidence">
          <ul className="flex flex-col gap-2 text-sm">
            {step.evidence.map((e, i) => (
              <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="shrink-0 font-mono text-xs text-muted sm:w-44 sm:truncate" title={e.source}>
                  {e.source}
                </span>
                <span className="min-w-0">{e.detail}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {step.feedback && (
        <Block title="Feedback for the team">
          <blockquote className="border-l-2 border-accent pl-3 text-sm">{step.feedback}</blockquote>
        </Block>
      )}

      {step.flags.length > 0 && (
        <Block title="Flags">
          <ul className="flex flex-col gap-2 text-sm">
            {step.flags.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Badge tone={f.kind === "prompt_injection" || f.kind === "suspicious" ? "danger" : "warning"}>{FLAG_LABELS[f.kind]}</Badge>
                <span className="pt-0.5">{f.note}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {step.doubleCheck && (
        <Block title="Double check">
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <Badge tone={step.doubleCheck.agreed ? "success" : "warning"}>{step.doubleCheck.agreed ? "agreed" : "disagreed"}</Badge>{" "}
              <span className="text-muted">
                {modelName(step.doubleCheck.model)} took a second look and said {valueLabel(step.doubleCheck)} (confidence{" "}
                {step.doubleCheck.confidence.toFixed(2)}).
              </span>
            </p>
            {!step.doubleCheck.agreed && step.doubleCheck.first && (
              <p className="text-muted">
                First verdict from {modelName(step.doubleCheck.first.model)}: {valueLabel(step.doubleCheck.first)}.{" "}
                {step.doubleCheck.first.reasoning}
              </p>
            )}
            {!step.doubleCheck.agreed && <p className="whitespace-pre-wrap">{step.doubleCheck.reasoning}</p>}
          </div>
        </Block>
      )}

      {step.guidance && (
        <Block title="Your direction for this project">
          <p className="text-sm">{step.guidance}</p>
        </Block>
      )}

      {step.trace.length > 0 && (
        <Block title="How it got there">
          <TraceList trace={step.trace} />
        </Block>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="mr-auto text-xs text-muted">
          {[
            step.model && (step.model === "rule" ? "scored by rule, no model" : modelName(step.model)),
            step.modelTier && tierLabel(step.modelTier),
            took !== null && duration(took),
            step.usage && `${tokens(step.usage.inputTokens + step.usage.outputTokens)} tokens`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <Button size="sm" variant="secondary" isDisabled={running || reviewBusy} onPress={() => onAction("rerun")}>
          <PixelIcon name="spark" size={10} /> Re-run…
        </Button>
        {!step.needsReview && (
          <Button size="sm" variant="secondary" isDisabled={running} onPress={() => onAction("flag")}>
            <PixelIcon name="flag" size={10} /> Flag…
          </Button>
        )}
        <Button size="sm" variant="secondary" isDisabled={running} onPress={() => onAction("override")}>
          <PixelIcon name="user" size={10} /> Override…
        </Button>
      </div>
      {c.scale === "pass_fail" && c.gate && step.passed === false && !step.override && (
        <p className="text-xs text-muted">A failed gate rules the project out when a phase closes, unless you override it.</p>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

function Callout({ tone, icon, title, children }: { tone: "warning" | "accent"; icon: IconName; title: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3 text-sm",
        tone === "warning" ? "bg-warning-soft text-warning-soft-foreground" : "bg-accent-soft text-accent-soft-foreground",
      )}
    >
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <PixelIcon name={icon} size={12} /> {title}
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

const TRACE_ICON: Record<TraceEntry["kind"], IconName> = {
  mechanism: "spark",
  tool: "search",
  command: "code",
  model: "chat",
  note: "dot",
  error: "x",
};

function TraceList({ trace }: { trace: TraceEntry[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  return (
    <ol className="flex flex-col">
      {trace.map((e, i) => {
        const icon = e.mechanism ? (mechanismInfo(e.mechanism)?.icon ?? TRACE_ICON[e.kind]) : TRACE_ICON[e.kind];
        const expandable = Boolean(e.detail);
        return (
          <li key={i} className="border-l-2 border-border pl-3">
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpenAt(openAt === i ? null : i)}
              className={cn("flex w-full items-start gap-2 py-1.5 text-left text-sm", expandable && "cursor-pointer hover:text-accent")}
            >
              <PixelIcon
                name={icon}
                size={10}
                className={cn("mt-1 shrink-0", e.ok === false || e.kind === "error" ? "text-danger" : "text-muted")}
              />
              <span className={cn("min-w-0 flex-1 break-words", e.kind === "command" && "font-mono text-xs leading-5")}>{e.title}</span>
              {e.ms != null && e.ms >= 500 && (
                <span className="shrink-0 font-pixel text-[10px] text-muted">{duration(Math.round(e.ms / 1000))}</span>
              )}
            </button>
            {openAt === i && e.detail && (
              <pre className="mb-2 max-h-80 overflow-auto rounded-md bg-surface-secondary p-3 font-mono text-xs whitespace-pre-wrap">{e.detail}</pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Directing a step ──────────────────────────────────────────────────────

function StepDrawer({
  mode,
  onClose,
  step,
  criterion: c,
  slug,
  projectId,
  models,
}: {
  mode: "rerun" | "override" | "flag";
  onClose: () => void;
  step: AgentStepView;
  criterion: Criterion;
  slug: string;
  projectId: string;
  models: Record<ModelTier, string>;
}) {
  const [guidance, setGuidance] = useState(step.guidance);
  const [tier, setTier] = useState<TierChoice>(step.modelTier ?? DEFAULT_TIER);
  const [score, setScore] = useState<number | null>(step.override?.score ?? step.score);
  const [passed, setPassed] = useState<boolean | null>(step.override?.passed ?? step.passed);
  const [note, setNote] = useState(mode === "override" ? (step.override?.note ?? "") : "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();

  const submit = () =>
    start(async () => {
      setError(undefined);
      const result =
        mode === "rerun"
          ? await rerunAgentStep(slug, projectId, c.id, { guidance, tier: tier === DEFAULT_TIER ? null : tier })
          : mode === "override"
            ? await overrideAgentStep(slug, step.id, c.scale === "score" ? score : passed, note)
            : await flagAgentStep(slug, step.id, true, note);
      if ("error" in result) return setError(result.error);
      onClose();
    });

  const title = { rerun: "Re-run this step", override: "Override the verdict", flag: "Flag for a person" }[mode];
  const ready =
    mode === "rerun" ? true : mode === "flag" ? note.trim().length > 0 : note.trim().length > 0 && (c.scale === "score" ? score !== null : passed !== null);

  return (
    <EditDrawer
      isOpen
      onClose={onClose}
      eyebrow={c.title}
      title={title}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="tertiary" onPress={onClose}>
            Cancel
          </Button>
          <Button isDisabled={readOnly || pending || !ready} onPress={submit}>
            {pending ? "Saving…" : { rerun: "Re-run step", override: "Save override", flag: "Flag it" }[mode]}
          </Button>
        </div>
      }
    >
      <SaveError error={error} />
      {mode === "rerun" && (
        <>
          <p className="text-sm text-muted">
            The agent judges &ldquo;{c.title}&rdquo; again for this project only. The current verdict stays until the new one
            is in, and the change goes in the audit trail.
          </p>
          {c.agentGuidance && (
            <p className="rounded-lg bg-surface-secondary px-3.5 py-3 text-xs text-muted">
              <span className="font-pixel uppercase tracking-wide">Always applies:</span> {c.agentGuidance}
            </p>
          )}
          <GuidanceField
            value={guidance}
            onChange={setGuidance}
            placeholder={
              c.mechanisms.includes("code_scraper") || c.mechanisms.includes("sandbox_run")
                ? "e.g. The model call is in server/agent.py, not the frontend. Check it isn't mocked."
                : "e.g. The problem is stated at 0:40, not the start. Judge the second half of the demo."
            }
          />
          <TierField
            value={tier}
            onChange={setTier}
            models={models}
            allowDefault
            defaultLabel={`Default (${tierLabel(c.agentModel)})`}
            defaultHint={`The model set for this criterion: ${modelName(models[c.agentModel])}.`}
          />
        </>
      )}

      {mode === "override" && (
        <>
          <p className="text-sm text-muted">
            Your verdict counts in place of the agent&apos;s ({valueLabel(step)}) and clears its flag. The change goes in the
            audit trail with your name.
          </p>
          {c.scale === "score" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <Eyebrow>Score</Eyebrow>
                <span className="font-pixel text-xl">{score ?? "–"}</span>
              </div>
              <BlockRating label={c.title} value={score} onChange={setScore} ghost={step.score} />
              <span className="text-xs text-muted">The dot marks the agent&apos;s score.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Eyebrow>Verdict</Eyebrow>
              <Segmented
                size="sm"
                value={passed === true ? "pass" : passed === false ? "fail" : ("" as "pass")}
                onChange={(v) => setPassed(v === "pass")}
                options={[
                  { value: "pass", label: "Pass" },
                  { value: "fail", label: "Fail" },
                ]}
                className="w-full [&>button]:flex-1 [&>button]:justify-center"
              />
            </div>
          )}
          <label className="flex flex-col gap-2">
            <Eyebrow>Why</Eyebrow>
            <TextArea
              rows={4}
              maxLength={4000}
              value={note}
              placeholder="What did the agent miss or get wrong?"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </>
      )}

      {mode === "flag" && (
        <>
          <p className="text-sm text-muted">
            Marks the step as needing a person. It shows on Progress until someone overrides it, re-runs it, or says it
            looks right.
          </p>
          <label className="flex flex-col gap-2">
            <Eyebrow>What needs a second look?</Eyebrow>
            <TextArea
              rows={4}
              maxLength={2000}
              value={note}
              placeholder="e.g. The score seems high for a demo that only runs locally."
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </>
      )}
    </EditDrawer>
  );
}
