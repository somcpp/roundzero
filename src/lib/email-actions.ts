"use server";

import { revalidatePath } from "next/cache";
import { buildAnnouncement, type AnnounceKind } from "@/lib/email/announce";
import { startAnnouncement, startJudgeLink } from "@/lib/email/runs";
import { getHackathon } from "@/lib/hackathons";
import { createClient } from "@/lib/supabase/server";

// The owner's email buttons. Each checks the signed-in owner owns the
// hackathon (getHackathon), then hands the sending to a workflow.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

export type EmailActionResult = { error: string } | { queued: number };

async function announce(slug: string, kind: AnnounceKind): Promise<EmailActionResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const announcement = await buildAnnouncement(hackathon, kind);
  if ("error" in announcement) return announcement;
  if (!announcement.recipients.length) {
    return { error: "Everyone with a contact email has already been sent this one." };
  }
  try {
    await startAnnouncement(announcement);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start sending." };
  }
  revalidatePath(`/h/${slug}/results`);
  return { queued: announcement.recipients.length };
}

/** Email every winning project its prizes. Projects already emailed are skipped. */
export async function emailWinners(slug: string) {
  return announce(slug, "winner");
}

/** Email the thank-you to every project that didn't win. Projects already emailed are skipped. */
export async function emailEveryoneElse(slug: string) {
  return announce(slug, "thank_you");
}

/** Send a judge their link and queue for the running phase again. */
export async function emailJudgeLink(slug: string, judgeId: string): Promise<EmailActionResult> {
  if (!UUID.test(judgeId)) return { error: "Invalid judge. Reload and try again." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const { data: judge } = await supabase
    .from("judges")
    .select("email")
    .eq("id", judgeId)
    .eq("hackathon_id", hackathon.id)
    .maybeSingle<{ email: string }>();
  if (!judge) return { error: "Judge not found." };
  if (!judge.email) return { error: "Add an email for this judge first." };
  try {
    await startJudgeLink(hackathon.id, judgeId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send the link." };
  }
  return { queued: 1 };
}

/** Where "phase done" and "phase due" emails go. Blank sends them to the owner's account email. */
export async function saveNotifyEmail(slug: string, email: string): Promise<{ error: string } | { ok: true }> {
  const value = String(email ?? "").trim().toLowerCase();
  if (value && (value.length > 254 || !EMAIL.test(value))) return { error: "That email doesn't look right." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const { error } = await supabase.from("hackathons").update({ notify_email: value }).eq("id", hackathon.id);
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}/setup/general`);
  return { ok: true };
}
