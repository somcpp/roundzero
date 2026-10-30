import { MAX_ITEMS } from "@/emails/agent-inbox";
import { appUrl } from "@/lib/email/config";
import { loadEmailContext } from "@/lib/email/context";
import { getFailedInbox } from "@/lib/failed-inbox";
import { listPhases } from "@/lib/judging";
import { createClient } from "@/lib/supabase/server";
import type { AgentInboxSend } from "@/workflows/agent-inbox/steps";

// The agent-failed inbox email, read as the signed-in owner when an agent run
// ends (the same reads as the Inbox drawer) and snapshotted into
// src/workflows/agent-inbox. It goes to the owner even when Setup ›
// Distribution names a judge to review failures, since only the owner can
// decide. Keyed on the newest failure: a run that fails nothing new sends
// nothing, and each new failure sends one email listing everything waiting.

/** The email to send, or null when nothing's waiting, nobody reviews failures, or there's no address for the owner. */
export async function buildAgentInboxEmail(hackathonId: string): Promise<AgentInboxSend | null> {
  const supabase = await createClient();
  const [inbox, ctx, phases, newest] = await Promise.all([
    getFailedInbox(hackathonId),
    loadEmailContext(hackathonId),
    listPhases(hackathonId),
    supabase
      .from("agent_reviews")
      .select("project_id, finished_at, projects!inner(hackathon_id)")
      .eq("projects.hackathon_id", hackathonId)
      .eq("gate_passed", false)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ project_id: string; finished_at: string }>(),
  ]);
  if (newest.error) throw new Error(`Couldn't load the agent's gate failures: ${newest.error.message}`);
  // With nobody picked, failures just stand.
  if (inbox.owner === "nobody" || !inbox.pending.length || !newest.data || !ctx?.ownerInbox) return null;

  const phase = phases.find((p) => p.startedAt && !p.closedAt);
  return {
    hackathonId,
    to: ctx.ownerInbox,
    fromName: ctx.fromName,
    phaseId: phase?.id ?? null,
    dedupeKey: `agent_inbox:${newest.data.project_id}:${Date.parse(newest.data.finished_at)}`,
    props: {
      hackathon: ctx.hackathon,
      pending: inbox.pending.length,
      items: inbox.pending.slice(0, MAX_ITEMS).map((i) => ({
        number: i.number,
        name: i.name,
        pitch: i.pitch,
        agentTotal: i.agentTotal,
        gates: i.gates.map((g) => ({ title: g.title, reason: g.reason })),
      })),
      phaseName: phase?.name ?? null,
      inboxUrl: `${appUrl()}/h/${ctx.hackathon.slug}/judging/progress?inbox=open`,
      reminder: 0,
      reviewer: inbox.judge?.name ?? null,
    },
  };
}
