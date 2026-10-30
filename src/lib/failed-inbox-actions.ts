"use server";

import { revalidatePath } from "next/cache";
import { getFailedInbox, type FailedInbox } from "@/lib/failed-inbox";
import { getHackathon, getViewableHackathon } from "@/lib/hackathons";
import { createClient } from "@/lib/supabase/server";

// The agent-failed inbox's calls (supabase/migrations/*_failed_inbox.sql).
// Each returns the inbox as it stands after, so the drawer can redraw.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

export type FailedInboxResult = { error: string } | { inbox: FailedInbox };

async function load(hackathonId: string): Promise<FailedInboxResult> {
  try {
    return { inbox: await getFailedInbox(hackathonId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't load the inbox." };
  }
}

/** The projects the agent failed on a gate, waiting and decided. Read-only, so demo accounts can open it too. */
export async function loadFailedInbox(slug: string): Promise<FailedInboxResult> {
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  return load(hackathon.id);
}

async function decide(
  slug: string,
  projectId: string,
  decision: "upheld" | "overturned" | null,
  note = "",
  eliminate = false,
): Promise<FailedInboxResult> {
  if (!UUID.test(projectId)) return { error: "Invalid project id. Reload and try again." };
  const reason = String(note ?? "").trim();
  if (reason.length > 2000) return { error: "Keep the note under 2000 characters." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_agent_gate", {
    p_hackathon_id: hackathon.id,
    p_project_id: projectId,
    p_decision: decision,
    p_note: reason,
    p_eliminate: eliminate,
  });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return load(hackathon.id);
}

/** Agree with the agent: the failure stands, and optionally the project is eliminated now. */
export async function upholdAgentGate(slug: string, projectId: string, note: string, eliminate: boolean) {
  return decide(slug, projectId, "upheld", note, Boolean(eliminate));
}

/** Disagree with the agent: the failure is cleared and the project ranks on its scores. */
export async function overturnAgentGate(slug: string, projectId: string, note: string) {
  return decide(slug, projectId, "overturned", note);
}

/** Take a call back. A project the call eliminated is reinstated if its phase is still running. */
export async function undoAgentGateDecision(slug: string, projectId: string) {
  return decide(slug, projectId, null);
}
