import { emptyRewardEmail, type RewardEmail } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** A row of public.reward_emails (supabase/migrations/*_reward_emails.sql). */
type RewardEmailRow = {
  from_name: string;
  title: string;
  description: string;
  link_url: string;
  link_label: string;
  fine_print: string;
};

/** A hackathon's winner email settings, or blanks (the defaults) if never saved. RLS limits it to the owner. */
export async function getRewardEmail(hackathonId: string): Promise<RewardEmail> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_emails")
    .select("from_name, title, description, link_url, link_label, fine_print")
    .eq("hackathon_id", hackathonId)
    .maybeSingle<RewardEmailRow>();
  if (error) throw new Error(`Couldn't load the email settings: ${error.message}`);
  if (!data) return emptyRewardEmail;
  return {
    fromName: data.from_name,
    title: data.title,
    description: data.description,
    linkUrl: data.link_url,
    linkLabel: data.link_label,
    finePrint: data.fine_print,
  };
}
