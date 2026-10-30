import { emptyThankYouEmail, type RewardItem, type ThankYouEmailSettings } from "@/lib/data";
import { MISSING_TABLE } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

/** A row of public.thank_you_emails (supabase/migrations/*_thank_you_emails.sql). */
type ThankYouEmailRow = {
  enabled: boolean;
  from_name: string;
  subject: string;
  title: string;
  message: string;
  show_winners: boolean;
  gift_title: string;
  gift_description: string;
  gift_items: RewardItem[];
  link_url: string;
  link_label: string;
  fine_print: string;
};

/**
 * A hackathon's thank-you email settings, or the defaults if never saved (or
 * before the thank_you_emails migration is applied). RLS limits it to the owner.
 */
export async function getThankYouEmail(hackathonId: string): Promise<ThankYouEmailSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thank_you_emails")
    .select(
      "enabled, from_name, subject, title, message, show_winners, gift_title, gift_description, gift_items, link_url, link_label, fine_print",
    )
    .eq("hackathon_id", hackathonId)
    .maybeSingle<ThankYouEmailRow>();
  if (error && MISSING_TABLE.has(error.code)) return emptyThankYouEmail;
  if (error) throw new Error(`Couldn't load the thank-you email: ${error.message}`);
  if (!data) return emptyThankYouEmail;
  return {
    enabled: data.enabled,
    fromName: data.from_name,
    subject: data.subject,
    title: data.title,
    message: data.message,
    showWinners: data.show_winners,
    giftTitle: data.gift_title,
    giftDescription: data.gift_description,
    giftItems: data.gift_items,
    linkUrl: data.link_url,
    linkLabel: data.link_label,
    finePrint: data.fine_print,
  };
}

/** How many judge reviews were submitted across every phase. */
export async function countSubmittedReviews(hackathonId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("judge_assignments")
    .select("phase_id, judging_phases!inner(hackathon_id)", { count: "exact", head: true })
    .eq("judging_phases.hackathon_id", hackathonId)
    .not("submitted_at", "is", null);
  if (error) throw new Error(`Couldn't count reviews: ${error.message}`);
  return count ?? 0;
}

/** The numbers the thank-you email shows: projects submitted, judges, and reviews they wrote. */
export async function getThankYouStats(hackathonId: string): Promise<{ projects: number; judges: number; reviews: number }> {
  const supabase = await createClient();
  const [projects, judges, reviews] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("hackathon_id", hackathonId),
    supabase.from("judges").select("id", { count: "exact", head: true }).eq("hackathon_id", hackathonId),
    countSubmittedReviews(hackathonId),
  ]);
  const error = projects.error ?? judges.error;
  if (error) throw new Error(`Couldn't count projects and judges: ${error.message}`);
  return { projects: projects.count ?? 0, judges: judges.count ?? 0, reviews };
}
