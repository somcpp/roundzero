"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { signalIfPhaseComplete } from "@/lib/email/runs";
import { getHackathon } from "@/lib/hackathons";
import { createClient } from "@/lib/supabase/server";

export type SubmitScoreResult = { error: string } | { total: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why a set of scores can't be sent, or null when they look right. The database checks them again. */
function badScores(scores: Record<string, number | boolean>, notes: string): string | null {
  if (!Object.keys(scores).every((id) => UUID.test(id))) return "Something here has an invalid id. Reload and try again.";
  for (const v of Object.values(scores)) {
    if (typeof v === "number" ? !(Number.isInteger(v) && v >= 1 && v <= 10) : typeof v !== "boolean") {
      return "Scores must be whole numbers from 1 to 10, or pass/fail.";
    }
  }
  if (String(notes ?? "").trim().length > 4000) return "Keep notes under 4000 characters.";
  return null;
}

/**
 * Submit a judge's scores for a project as the signed-in admin, on the judge's
 * behalf. The database checks every criterion is scored, stores the total, and
 * logs it to the project's audit trail with the admin's user id.
 */
export async function submitJudgeScore(
  slug: string,
  assignmentId: string,
  scores: Record<string, number | boolean>,
  notes: string,
): Promise<SubmitScoreResult> {
  if (!UUID.test(assignmentId)) return { error: "Something here has an invalid id. Reload and try again." };
  const bad = badScores(scores, notes);
  if (bad) return { error: bad };
  const note = String(notes ?? "").trim();

  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_judge_score", {
    p_hackathon_id: hackathon.id,
    p_assignment_id: assignmentId,
    p_scores: scores,
    p_notes: note,
  });
  if (error) return { error: error.message };

  // If that was the phase's last review, the owner gets told it's their move.
  after(() => signalIfPhaseComplete(hackathon.id));
  revalidatePath(`/h/${slug}`, "layout");
  return { total: Number(data) };
}

/**
 * Score a project yourself, as the signed-in admin, for the phase it's in.
 * It's one more review in that phase's average and leaves the assigned
 * judges' alone. Submitting again updates it. Logged to the audit trail.
 */
export async function submitAdminScore(
  slug: string,
  projectId: string,
  scores: Record<string, number | boolean>,
  notes: string,
): Promise<SubmitScoreResult> {
  if (!UUID.test(projectId)) return { error: "Invalid project id. Reload and try again." };
  const bad = badScores(scores, notes);
  if (bad) return { error: bad };

  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_admin_score", {
    p_hackathon_id: hackathon.id,
    p_project_id: projectId,
    p_scores: scores,
    p_notes: String(notes ?? "").trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { total: Number(data) };
}

/** Take back your own review of a project in the running phase. Logged to the audit trail. */
export async function removeAdminScore(slug: string, projectId: string): Promise<{ error: string } | { ok: true }> {
  if (!UUID.test(projectId)) return { error: "Invalid project id. Reload and try again." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_admin_score", { p_hackathon_id: hackathon.id, p_project_id: projectId });
  if (error) return { error: error.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}
