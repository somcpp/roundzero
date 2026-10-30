import JudgeBatchEmail, { judgeBatchSubject } from "@/emails/judge-batch";
import JudgeInviteEmail, { judgeInviteSubject } from "@/emails/judge-invite";
import OwnerUpdateEmail, { ownerUpdateSubject } from "@/emails/owner-update";
import type { SchemaBlock } from "@/lib/data";
import { appUrl } from "@/lib/email/config";
import { loadEmailContext, type EmailContext } from "@/lib/email/context";
import { adminDb, deliver, pace, type Delivery } from "@/lib/email/deliver";
import { MINUTES_PER_PROJECT, firstName, toJudgePortal, type PortalRow } from "@/lib/judge-portal";
import { projectHeadline } from "@/lib/project-fields";
import { phaseKey, type PhaseRun } from "@/workflows/hooks";

// Steps for ./index.ts. Each one re-reads the database, so the emails follow
// what's true when they go out (a judge who already pulled tomorrow's batch
// early doesn't get told about it), and each checks the phase is still the
// one this run was started for; if not, the run stops.

const DAY_MS = 24 * 60 * 60 * 1000;
/** Judges per step: a step's sends run one after another, so this caps a step's length. */
const CHUNK = 10;

type PhaseRow = {
  id: string;
  name: string;
  position: number;
  started_at: string | null;
  closed_at: string | null;
  advance_count: number | null;
};

type Live = { ctx: EmailContext; phase: PhaseRow; index: number; count: number; next: PhaseRow | null };

/** The phase and its hackathon, or null when the phase has closed or been restarted since the run began. */
async function live(run: PhaseRun): Promise<Live | null> {
  const db = adminDb();
  const { data: phases, error } = await db
    .from("judging_phases")
    .select("id, name, position, started_at, closed_at, advance_count")
    .eq("hackathon_id", run.hackathonId)
    .order("position")
    .returns<PhaseRow[]>();
  if (error) throw new Error(`Couldn't load phases: ${error.message}`);
  const index = phases.findIndex((p) => p.id === run.phaseId);
  const phase = phases[index];
  if (!phase?.started_at || phase.closed_at || Date.parse(phase.started_at) !== Date.parse(run.startedAt)) return null;
  const ctx = await loadEmailContext(run.hackathonId);
  if (!ctx) return null;
  return { ctx, phase, index, count: phases.length, next: phases[index + 1] ?? null };
}

async function reviewCounts(phaseId: string) {
  const db = adminDb();
  const all = () =>
    db.from("judge_assignments").select("id", { count: "exact", head: true }).eq("phase_id", phaseId).not("judge_id", "is", null);
  const [total, done] = await Promise.all([all(), all().not("submitted_at", "is", null)]);
  if (total.error || done.error) throw new Error(`Couldn't count reviews: ${(total.error ?? done.error)!.message}`);
  return { total: total.count ?? 0, done: done.count ?? 0 };
}

const roundLabel = (l: Pick<Live, "index" | "count">) => `round ${l.index + 1} of ${l.count}`;

// ── Plan ──────────────────────────────────────────────────────────────────

export type PhasePlan = {
  /** When each later daily batch opens (ISO), in order; empty when everything opens at once. */
  batchOpens: string[];
  /** When the phase's days are up (daily batches only). */
  dueAt: string | null;
  complete: boolean;
};

/** How this phase is paced, or null if it's no longer running. */
export async function planPhase(run: PhaseRun): Promise<PhasePlan | null> {
  "use step";
  const l = await live(run);
  if (!l) return null;
  const { data: settings } = await adminDb()
    .from("distribution_settings")
    .select("cadence, batch_days")
    .eq("hackathon_id", run.hackathonId)
    .maybeSingle<{ cadence: "once" | "daily"; batch_days: number }>();
  const start = Date.parse(l.phase.started_at!);
  const daily = settings?.cadence === "daily";
  const days = daily ? settings.batch_days : 0;
  const { total, done } = await reviewCounts(run.phaseId);
  return {
    batchOpens: Array.from({ length: Math.max(0, days - 1) }, (_, i) => new Date(start + (i + 1) * DAY_MS).toISOString()),
    dueAt: daily ? new Date(start + days * DAY_MS).toISOString() : null,
    complete: total > 0 && done === total,
  };
}

/** Whether the phase is still running and every review is in. */
export async function checkPhase(run: PhaseRun): Promise<"stale" | "complete" | "open"> {
  "use step";
  if (!(await live(run))) return "stale";
  const { total, done } = await reviewCounts(run.phaseId);
  return total > 0 && done === total ? "complete" : "open";
}

// ── Judges ────────────────────────────────────────────────────────────────

/** Judges with work in the phase and an email address, in chunks for emailJudges; null if the phase moved on. */
export async function phaseJudges(run: PhaseRun): Promise<string[][] | null> {
  "use step";
  if (!(await live(run))) return null;
  const { data, error } = await adminDb()
    .from("judges")
    .select("id, email, judge_assignments!inner(phase_id)")
    .eq("hackathon_id", run.hackathonId)
    .eq("judge_assignments.phase_id", run.phaseId)
    .neq("email", "")
    .order("name")
    .returns<{ id: string }[]>();
  if (error) throw new Error(`Couldn't load judges: ${error.message}`);
  const ids = data.map((j) => j.id);
  return Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) => ids.slice(i * CHUNK, (i + 1) * CHUNK));
}

export type Tally = { sent: number; skipped: number; failed: number };

/**
 * One email to each judge in `judgeIds`:
 *   • "invite": their link and queue, as the phase starts.
 *   • "batch": day `day`'s batch (0-based batch index `day`) just opened.
 *   • "last call": the phase is due and they have projects left.
 * Judges with nothing new or nothing left are skipped. Null if the phase moved on.
 * `resend` (e.g. the owner's "Email link" click time) makes it a fresh email
 * rather than one that already went out.
 */
export async function emailJudges(
  run: PhaseRun,
  kind: "invite" | "batch" | "last call",
  day: number,
  judgeIds: string[],
  resend = "",
): Promise<Tally | null> {
  "use step";
  const l = await live(run);
  if (!l) return null;
  const db = adminDb();
  const { data: judges, error } = await db
    .from("judges")
    .select("id, name, email, access_token")
    .eq("hackathon_id", run.hackathonId)
    .in("id", judgeIds)
    .returns<{ id: string; name: string; email: string; access_token: string }[]>();
  if (error) throw new Error(`Couldn't load judges: ${error.message}`);

  const tally: Tally = { sent: 0, skipped: 0, failed: 0 };
  const phaseLabel = `${l.phase.name} · ${roundLabel(l)}`;
  const key = phaseKey(run);
  for (const judge of judges) {
    const { data: row, error: portalError } = await db.rpc("judge_portal", { p_token: judge.access_token, p_assignment_id: null });
    if (portalError) throw new Error(`Couldn't load ${judge.name}'s queue: ${portalError.message}`);
    const portal = row ? toJudgePortal(row as PortalRow) : null;
    // The portal only shows the running phase; anything else means this run is behind.
    if (!portal?.phase || portal.phase.id !== run.phaseId) return null;
    const queue = portal.queue;
    const left = queue.filter((q) => !q.submittedAt);
    const judgeUrl = `${appUrl()}/j/${judge.access_token}`;
    const common = {
      hackathonId: run.hackathonId,
      to: judge.email,
      fromName: l.ctx.fromName,
      replyTo: l.ctx.ownerInbox,
      phaseId: run.phaseId,
      judgeId: judge.id,
    };

    let result: Delivery;
    if (kind === "invite") {
      if (!queue.length) {
        tally.skipped++;
        continue;
      }
      const perDay = portal.plan?.daily ? portal.plan.perDay : null;
      result = await deliver({
        ...common,
        kind: "judge_invite",
        dedupeKey: `judge_invite:${key}:${judge.id}${resend && `:${resend}`}`,
        subject: judgeInviteSubject(l.ctx.hackathon),
        element: (
          <JudgeInviteEmail
            hackathon={l.ctx.hackathon}
            firstName={firstName(judge.name)}
            judgeUrl={judgeUrl}
            phaseLabel={phaseLabel}
            projects={queue.length}
            perDay={perDay}
            minutes={Math.min(perDay ?? queue.length, queue.length) * MINUTES_PER_PROJECT}
            settings={portal.settings}
            fromName={l.ctx.fromName}
            criteria={portal.criteria}
          />
        ),
      });
    } else {
      const fresh = kind === "batch" ? left.filter((q) => q.batch === day).length : left.length;
      const leftover = kind === "batch" ? left.filter((q) => q.batch < day).length : 0;
      if (!fresh) {
        tally.skipped++;
        continue;
      }
      const variant = kind;
      const emailKind = kind === "batch" ? "judge_batch" : "judge_last_call";
      result = await deliver({
        ...common,
        kind: emailKind,
        dedupeKey: `${emailKind}:${key}:${judge.id}${kind === "batch" ? `:${day}` : ""}`,
        subject: judgeBatchSubject(l.ctx.hackathon, { variant, fresh, day: day + 1 }),
        element: (
          <JudgeBatchEmail
            hackathon={l.ctx.hackathon}
            variant={variant}
            firstName={firstName(judge.name)}
            judgeUrl={judgeUrl}
            phaseLabel={phaseLabel}
            day={day + 1}
            fresh={fresh}
            leftover={leftover}
            done={queue.length - left.length}
            total={queue.length}
            minutes={(fresh + leftover) * MINUTES_PER_PROJECT}
          />
        ),
      });
    }
    if (result === "sent") tally.sent++;
    else if (result === "failed") tally.failed++;
    else tally.skipped++;
    if (result === "sent") await pace();
  }
  return tally;
}

// ── Owner ─────────────────────────────────────────────────────────────────

/** Top of the phase ranking with names and average judge scores. */
async function leaders(phaseId: string, hackathonId: string, count: number) {
  const db = adminDb();
  const { data: ranked, error } = await db.rpc("rank_phase", { p_phase_id: phaseId });
  if (error) throw new Error(`Couldn't rank the phase: ${error.message}`);
  const ids = (ranked as { project_id: string; rank: number }[])
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .map((r) => r.project_id);
  if (!ids.length) return [];
  const [projects, blocks, scores] = await Promise.all([
    db.from("projects").select("id, number, project_values(block_id, value)").in("id", ids),
    db.from("schema_blocks").select("id, title, type, description, expected").eq("hackathon_id", hackathonId).order("position"),
    db.from("judge_assignments").select("project_id, score").eq("phase_id", phaseId).in("project_id", ids).not("submitted_at", "is", null),
  ]);
  if (projects.error || blocks.error || scores.error) {
    throw new Error(`Couldn't load the ranking: ${(projects.error ?? blocks.error ?? scores.error)!.message}`);
  }
  return ids.map((id) => {
    const p = projects.data.find((x) => x.id === id)!;
    const values = Object.fromEntries(p.project_values.map((v) => [v.block_id, v.value]));
    const mine = scores.data.filter((s) => s.project_id === id).map((s) => Number(s.score));
    return {
      number: p.number,
      name: projectHeadline({ number: p.number, values }, blocks.data as SchemaBlock[]).name,
      score: mine.length ? mine.reduce((a, b) => a + b, 0) / mine.length : null,
    };
  });
}

/** Judges with reviews still open, most first. */
async function behind(phaseId: string) {
  const { data, error } = await adminDb()
    .from("judge_assignments")
    .select("judge_id, judges(name)")
    .eq("phase_id", phaseId)
    .is("submitted_at", null)
    .not("judge_id", "is", null)
    .returns<{ judge_id: string; judges: { name: string } | null }[]>();
  if (error) throw new Error(`Couldn't load open reviews: ${error.message}`);
  const counts = new Map<string, { name: string; left: number }>();
  for (const a of data) {
    const entry = counts.get(a.judge_id) ?? { name: a.judges?.name ?? "A judge", left: 0 };
    entry.left++;
    counts.set(a.judge_id, entry);
  }
  return [...counts.values()].sort((a, b) => b.left - a.left).slice(0, 8);
}

/** Decisions the owner should make before closing the phase. */
async function attention(phaseId: string) {
  const { count, error } = await adminDb()
    .from("agent_reviews")
    .select("project_id, projects!inner(phase_id, status)", { count: "exact", head: true })
    .eq("gate_passed", false)
    .is("gate_decision", null)
    .eq("projects.phase_id", phaseId)
    .eq("projects.status", "active");
  // Older databases may not have gate decisions yet; that just means nothing to flag.
  if (error || !count) return [];
  return [`${count} ${count === 1 ? "project failed a must-pass check and needs" : "projects failed a must-pass check and need"} your call.`];
}

/**
 * Tell the owner it's their move: "done" when every review is in, "due" when
 * the days are up with reviews missing. `reminder` > 0 re-sends "done".
 */
export async function notifyOwner(run: PhaseRun, variant: "done" | "due", reminder: number): Promise<Delivery | "stale" | "no inbox"> {
  "use step";
  const l = await live(run);
  if (!l) return "stale";
  if (!l.ctx.ownerInbox) return "no inbox";
  const db = adminDb();
  // The top of the ranking (the ones going through, up to 10), and a few just under the cut.
  const shown = Math.min(l.phase.advance_count ?? 5, 10);
  const cut = l.next && l.phase.advance_count !== null && l.phase.advance_count <= 10 ? 3 : 0;
  const [reviews, projects, ranked, late, flags] = await Promise.all([
    reviewCounts(run.phaseId),
    db.from("projects").select("id", { count: "exact", head: true }).eq("phase_id", run.phaseId).neq("status", "disqualified"),
    leaders(run.phaseId, run.hackathonId, shown + cut),
    variant === "due" ? behind(run.phaseId) : Promise.resolve([]),
    attention(run.phaseId),
  ]);
  const kind = variant === "done" ? "owner_phase_done" : "owner_phase_due";
  const props = {
    hackathon: l.ctx.hackathon,
    variant,
    phaseName: l.phase.name,
    roundLabel: roundLabel(l),
    nextPhase: l.next?.name ?? null,
    advanceCount: l.next ? l.phase.advance_count : null,
    reviews,
    projects: projects.count ?? 0,
    leaders: ranked.slice(0, shown),
    belowCut: ranked.slice(shown),
    behind: late,
    attention: flags,
    inboxUrl: flags.length ? `${appUrl()}/h/${l.ctx.hackathon.slug}/judging/progress?inbox=open` : undefined,
    progressUrl: `${appUrl()}/h/${l.ctx.hackathon.slug}/judging/progress`,
    reminder,
  };
  return deliver({
    hackathonId: run.hackathonId,
    kind,
    dedupeKey: `${kind}:${phaseKey(run)}:${reminder}`,
    to: l.ctx.ownerInbox,
    fromName: l.ctx.fromName,
    subject: ownerUpdateSubject(l.ctx.hackathon, props),
    element: <OwnerUpdateEmail {...props} />,
    phaseId: run.phaseId,
  });
}
