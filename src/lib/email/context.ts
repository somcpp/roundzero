import type { EmailHackathon } from "@/emails/_components/shell";
import { adminDb } from "@/lib/email/deliver";
import { hackathonLogoUrl } from "@/lib/hackathon-logos";

// What every email about a hackathon needs, read with the secret key since
// workflow steps run with no signed-in owner. Callers pass ids they got from
// the owner's own session (a server action), never from outside input.

export type EmailContext = {
  hackathon: EmailHackathon & { id: string };
  /** Where owner notifications go: hackathons.notify_email, else the owner's account email. */
  ownerInbox: string | null;
  /** Sender name for judges and the owner: the winner email's sender name, else the hackathon's name. */
  fromName: string;
};

export async function loadEmailContext(hackathonId: string): Promise<EmailContext | null> {
  const db = adminDb();
  // "*" so this keeps working if notify_email's migration isn't applied yet.
  const { data: h, error } = await db
    .from("hackathons")
    .select("*")
    .eq("id", hackathonId)
    .maybeSingle<{ id: string; owner_id: string; name: string; slug: string; logo: string; logo_path: string | null; color: string; notify_email?: string }>();
  if (error) throw new Error(`Couldn't load the hackathon: ${error.message}`);
  if (!h) return null;

  const [{ data: reward }, owner] = await Promise.all([
    db.from("reward_emails").select("from_name").eq("hackathon_id", hackathonId).maybeSingle<{ from_name: string }>(),
    h.notify_email ? null : db.auth.admin.getUserById(h.owner_id),
  ]);

  return {
    hackathon: { id: h.id, name: h.name, slug: h.slug, logo: h.logo, logoUrl: hackathonLogoUrl(h.logo_path), color: h.color },
    ownerInbox: h.notify_email || owner?.data.user?.email || null,
    fromName: reward?.from_name || h.name,
  };
}
