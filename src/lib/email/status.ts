import { createClient } from "@/lib/supabase/server";

// What's gone out, for the admin pages. Reads public.email_sends as the owner.

/** When each judge's link for a phase was last emailed, by judge id. */
export async function judgeInviteTimes(phaseId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_sends")
    .select("judge_id, sent_at")
    .eq("phase_id", phaseId)
    .eq("kind", "judge_invite")
    .eq("status", "sent")
    .order("sent_at");
  // Before the email_delivery migration there's nothing to show.
  if (error) return new Map();
  return new Map(data.filter((r) => r.judge_id && r.sent_at).map((r) => [r.judge_id as string, r.sent_at as string]));
}
