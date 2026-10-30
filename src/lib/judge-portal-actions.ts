"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { signalIfPhaseCompleteFor } from "@/lib/email/runs";
import { JUDGE_TOKEN } from "@/lib/judge-portal";
import { createClient } from "@/lib/supabase/server";

// What a judge does from their link. Nobody is signed in: the token is the
// credential, and the judge_* functions check it and only touch that judge's
// own queue (see supabase/migrations/*_judge_links.sql).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAD_LINK = { error: "This judging link doesn't look right. Open it again from the email you were sent." };

export type PortalScoreResult =
  | { error: string }
  | { total: number; gatePassed: boolean; adjusted: boolean; agentReady: boolean };

/** Submit, or change, the judge's scores for one project in their queue. */
export async function submitPortalScore(
  token: string,
  assignmentId: string,
  scores: Record<string, number | boolean>,
  notes: string,
): Promise<PortalScoreResult> {
  if (!JUDGE_TOKEN.test(token)) return BAD_LINK;
  if (!UUID.test(assignmentId) || !Object.keys(scores).every((id) => UUID.test(id))) {
    return { error: "Something here has an invalid id. Reload the page and try again." };
  }
  for (const v of Object.values(scores)) {
    if (typeof v === "number" ? !(Number.isInteger(v) && v >= 1 && v <= 10) : typeof v !== "boolean") {
      return { error: "Scores must be whole numbers from 1 to 10, or pass/fail." };
    }
  }
  const note = String(notes ?? "").trim();
  if (note.length > 4000) return { error: "Keep notes under 4000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("judge_submit_score", {
    p_token: token,
    p_assignment_id: assignmentId,
    p_scores: scores,
    p_notes: note,
  });
  if (error) return { error: error.message };
  const result = data as { total: number | string; gate_passed: boolean; adjusted: boolean; agent_ready: boolean };
  // If that was the phase's last review, the owner gets told it's their move.
  after(() => signalIfPhaseCompleteFor(assignmentId));
  revalidatePath(`/j/${token}`);
  return {
    total: Number(result.total),
    gatePassed: result.gate_passed,
    adjusted: result.adjusted,
    agentReady: result.agent_ready,
  };
}

/** Daily batches: open the judge's next batch now. Returns the first project in it. */
export async function pullNextBatch(token: string): Promise<{ error: string } | { next: string }> {
  if (!JUDGE_TOKEN.test(token)) return BAD_LINK;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("judge_release_batch", { p_token: token });
  if (error) return { error: error.message };
  revalidatePath(`/j/${token}`);
  return { next: data as string };
}
