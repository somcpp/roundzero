"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, Tabs } from "@heroui/react";
import { JudgePhoto } from "@/app/h/[slug]/setup/judges/judge-photo";
import type { FailedInbox, FailedInboxItem, FailedInboxSummary } from "@/lib/failed-inbox";
import {
  loadFailedInbox,
  overturnAgentGate,
  undoAgentGateDecision,
  upholdAgentGate,
  type FailedInboxResult,
} from "@/lib/failed-inbox-actions";
import { formatNumber } from "@/lib/project-fields";
import { ConfirmButton, ConfirmDialog } from "./confirm-button";
import { FieldLabel, TextArea, Toggle } from "./controls";
import { EditDrawer } from "./edit-drawer";
import { SaveError } from "./list-editor";
import { PixelIcon } from "./pixel-icon";
import { useReadOnly } from "./read-only";
import { Spinner } from "./shadcn/spinner";
import { Badge, Panel, TextLink, cn } from "./ui";

type Tab = "pending" | "decided";
type Call = { kind: "uphold" | "overturn"; item: FailedInboxItem };

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The Inbox button in the hackathon's top bar and the drawer it opens: every
 * project the agent failed on a gate, for someone to agree (the failure
 * stands) or disagree (it's cleared and the project goes back in the pool).
 * Hidden until there's something to look at.
 */
export function FailedInboxButton({ slug, summary }: { slug: string; summary: FailedInboxSummary }) {
  const linked = useSearchParams().get("inbox") === "open";
  const [open, setOpen] = useState(linked);
  const [tab, setTab] = useState<Tab>("pending");
  const [inbox, setInbox] = useState<FailedInbox>();
  const [error, setError] = useState<string>();
  const [loading, startLoad] = useTransition();
  // The dialog keeps its wording while it animates closed.
  const [call, setCall] = useState<Call & { open: boolean }>();
  const [note, setNote] = useState("");
  const [eliminate, setEliminate] = useState(false);
  const readOnly = useReadOnly();

  // Failures only land in an inbox when someone reviews them; with nobody they just stand.
  const counting = summary.owner !== "nobody";
  const visible = (counting && summary.pending > 0) || summary.decided > 0;

  const apply = (result: FailedInboxResult) => {
    if ("error" in result) return result.error;
    setInbox(result.inbox);
  };
  const show = () => {
    setOpen(true);
    setError(undefined);
    setTab(summary.pending > 0 ? "pending" : "decided");
    startLoad(async () => setError(apply(await loadFailedInbox(slug))));
  };

  // The agent-failed inbox email links here with ?inbox=open, which starts the
  // drawer open: load it, and drop the param so a reload doesn't open it again.
  useEffect(() => {
    if (!linked || !visible) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("inbox");
    window.history.replaceState(null, "", url);
    startLoad(async () => {
      const result = await loadFailedInbox(slug);
      if ("error" in result) setError(result.error);
      else setInbox(result.inbox);
    });
  }, [linked, visible, slug]);

  if (!visible) return null;
  const startCall = (kind: Call["kind"], item: FailedInboxItem) => {
    setNote("");
    setEliminate(false);
    setCall({ kind, item, open: true });
  };
  const closeCall = () => setCall((c) => c && { ...c, open: false });

  return (
    <>
      <button
        type="button"
        onClick={show}
        title="Agent-failed inbox"
        aria-label={counting && summary.pending ? `Agent-failed inbox, ${summary.pending} to decide` : "Agent-failed inbox"}
        className="flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-border px-2.5 text-sm font-semibold transition hover:border-accent sm:px-3"
      >
        <PixelIcon name="inbox" size={14} />
        <span className="hidden sm:inline">Inbox</span>
        {counting && summary.pending > 0 && (
          <Badge tone="danger" className="px-1.5 font-pixel tabular-nums">
            {summary.pending}
          </Badge>
        )}
      </button>

      <EditDrawer isOpen={open} onClose={() => setOpen(false)} wide eyebrow="Agent gate failures" title="Agent-failed inbox">
        <Owner inbox={inbox} summary={summary} slug={slug} onNavigate={() => setOpen(false)} />
        <p className="text-sm text-muted">
          The agent failed these projects on a gate. Agree and the failure stands: the project ranks below every
          project that passed and can&apos;t win an award. Disagree and it&apos;s cleared, so the project ranks on its
          scores like any other.
        </p>
        <SaveError error={error} />

        {!inbox ? (
          loading && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Loading…
            </span>
          )
        ) : (
          <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as Tab)} className="gap-0">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Agent-failed inbox">
                <Tabs.Tab id="pending">
                  To decide
                  <Count n={inbox.pending.length} />
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="decided">
                  Decided
                  <Count n={inbox.decided.length} />
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="pending" className="mt-4 flex flex-col gap-3 p-0">
              {inbox.pending.length === 0 ? (
                <Empty>Nothing to decide. Projects the agent fails on a gate show up here.</Empty>
              ) : (
                inbox.pending.map((item) => (
                  <ItemCard key={item.projectId} item={item} slug={slug} onNavigate={() => setOpen(false)}>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                      <Button size="sm" variant="secondary" isDisabled={readOnly} onPress={() => startCall("overturn", item)}>
                        <PixelIcon name="refresh" size={12} />
                        Disagree — back in the pool
                      </Button>
                      <Button size="sm" variant="danger-soft" isDisabled={readOnly} onPress={() => startCall("uphold", item)}>
                        <PixelIcon name="lock" size={12} />
                        Agree — keep it out
                      </Button>
                    </div>
                  </ItemCard>
                ))
              )}
            </Tabs.Panel>

            <Tabs.Panel id="decided" className="mt-4 flex flex-col gap-3 p-0">
              {inbox.decided.length === 0 ? (
                <Empty>No calls yet.</Empty>
              ) : (
                inbox.decided.map((item) => (
                  <ItemCard key={item.projectId} item={item} slug={slug} onNavigate={() => setOpen(false)}>
                    <Decided
                      item={item}
                      onUndo={async () => apply(await undoAgentGateDecision(slug, item.projectId))}
                    />
                  </ItemCard>
                ))
              )}
            </Tabs.Panel>
          </Tabs>
        )}

        {/* Inside the drawer, so pressing in the dialog doesn't count as leaving the drawer. */}
        <ConfirmDialog
          isOpen={!!call?.open}
          onCancel={closeCall}
          title={
            call?.kind === "overturn"
              ? `Put ${call.item.name} back in the pool?`
              : `Keep ${call?.item.name ?? "it"} out?`
          }
          description={
            call?.kind === "overturn"
              ? "The agent's gate failure is cleared. The project ranks on its scores like any other, can advance and can win awards."
              : "The gate failure stands: the project ranks below every project that passed and can't win an award."
          }
          confirmLabel={call?.kind === "overturn" ? "Back in the pool" : eliminate ? "Keep it out and eliminate" : "Keep it out"}
          pendingLabel="Saving…"
          onConfirm={async () => {
            if (!call) return;
            const result =
              call.kind === "overturn"
                ? await overturnAgentGate(slug, call.item.projectId, note)
                : await upholdAgentGate(slug, call.item.projectId, note, eliminate);
            const failed = apply(result);
            if (failed) return failed;
            closeCall();
          }}
        >
          <div className="mt-4 flex flex-col gap-4">
            {call?.kind === "uphold" && call.item.status === "active" && (
              <Toggle
                checked={eliminate}
                onChange={setEliminate}
                label="Eliminate it now"
                description="Takes it out of the running and judges' queues. Otherwise it stays in its phase and ranks last."
              />
            )}
            <label className="flex flex-col gap-2">
              <FieldLabel>Note</FieldLabel>
              <TextArea
                rows={3}
                value={note}
                maxLength={2000}
                placeholder="Optional. It goes in the audit trail."
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        </ConfirmDialog>
      </EditDrawer>
    </>
  );
}

/** Whose inbox it is: a judge's, the admin's, or nobody's. */
function Owner({
  inbox,
  summary,
  slug,
  onNavigate,
}: {
  inbox?: FailedInbox;
  summary: FailedInboxSummary;
  slug: string;
  onNavigate: () => void;
}) {
  const settings = (
    <TextLink href={`/h/${slug}/setup/distribution`} onClick={onNavigate}>
      Distribution
    </TextLink>
  );
  if (inbox?.judge) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-surface-secondary/60 px-3 py-2.5">
        <JudgePhoto name={inbox.judge.name} imagePath={inbox.judge.imagePath} size={32} />
        <span className="flex min-w-0 flex-col text-sm">
          <span>
            <b className="font-medium">{inbox.judge.name}</b> reviews these
          </span>
          <span className="text-xs text-muted">You can decide too. Change who reviews them in {settings}.</span>
        </span>
      </div>
    );
  }
  if (summary.owner === "nobody") {
    return (
      <p className="rounded-lg bg-surface-secondary/60 px-3 py-2.5 text-sm">
        Gate failures go to nobody, so they just stand. You can still decide here, or pick someone in {settings}.
      </p>
    );
  }
  return null;
}

function ItemCard({
  item,
  slug,
  onNavigate,
  children,
}: {
  item: FailedInboxItem;
  slug: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="pt-0.5 font-pixel text-sm text-muted">{formatNumber(item.number)}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/h/${slug}/judging/projects/${item.number}#agent`}
            onClick={onNavigate}
            className={cn("truncate font-medium hover:underline", item.status !== "active" && "text-muted")}
          >
            {item.name}
          </Link>
          {item.pitch && <span className="truncate text-xs text-muted">{item.pitch}</span>}
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {item.status !== "active" && <Badge>{item.status === "eliminated" ? "Eliminated" : "Disqualified"}</Badge>}
          {item.agentTotal !== null && (
            <span className="flex items-center gap-1 font-pixel text-sm" title="Agent's score">
              <PixelIcon name="spark" size={10} className="text-accent" />
              {item.agentTotal.toFixed(1)}
            </span>
          )}
        </span>
      </div>

      {item.gates.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {item.gates.map((g) => (
            <li key={g.criterionId} className="flex flex-col gap-1 rounded-lg bg-danger-soft/50 px-3 py-2">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <PixelIcon name="lock" size={10} className="text-danger" />
                {g.title}
                {g.overridden && <Badge>Overridden to a fail</Badge>}
              </span>
              {g.reason && <p className="line-clamp-4 text-sm whitespace-pre-line text-muted">{g.reason}</p>}
            </li>
          ))}
        </ul>
      ) : (
        item.summary && <p className="line-clamp-4 text-sm text-muted">{item.summary}</p>
      )}
      {children}
    </Panel>
  );
}

function Decided({ item, onUndo }: { item: FailedInboxItem; onUndo: () => Promise<string | undefined> }) {
  const d = item.decision!;
  const overturned = d.decision === "overturned";
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={overturned ? "success" : "danger"}>
          <PixelIcon name={overturned ? "refresh" : "lock"} size={10} />
          {overturned ? "Overturned · back in the pool" : d.eliminated ? "Upheld · eliminated" : "Upheld · kept out"}
        </Badge>
        <span className="text-xs text-muted">{when(d.decidedAt)}</span>
        <ConfirmButton
          className="ml-auto"
          title={`Undo the call on ${item.name}?`}
          description={
            overturned
              ? "It goes back to the inbox, and the agent's gate failure counts again: it ranks last and can't win until someone decides."
              : d.eliminated
                ? "It goes back to the inbox and is reinstated, unless its phase has closed. The failure still counts until someone decides."
                : "It goes back to the inbox. The failure still counts until someone decides."
          }
          confirmLabel="Undo"
          pendingLabel="Undoing…"
          onConfirm={onUndo}
        >
          Undo
        </ConfirmButton>
      </div>
      {d.note && <blockquote className="border-l-2 border-border-secondary pl-3 text-sm whitespace-pre-wrap">{d.note}</blockquote>}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-md bg-surface-secondary px-1.5 py-0.5 text-xs leading-none tabular-nums text-muted">
      {n}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-sm text-muted">{children}</p>
  );
}
