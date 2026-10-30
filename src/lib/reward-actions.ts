"use server";

import { revalidatePath } from "next/cache";
import { emptyRewardEmail, rewardIcon, type RewardEmail, type RewardSettings, type RewardTier } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { REWARD_IMAGE_BUCKET } from "@/lib/reward-images";
import { MISSING_TABLE, listRewardTiers } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

export type SaveRewardsResult = { error: string } | { items: RewardTier[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(Object.keys(rewardIcon));
const text = (v: unknown) => String(v ?? "").trim();

function clean(hackathonId: string, tiers: RewardTier[]): { rows: Record<string, unknown>[]; error?: string } {
  const rows: Record<string, unknown>[] = [];
  if (tiers.length > 50) return { rows, error: "Fifty reward tiers is the most." };
  for (const t of tiers) {
    const name = text(t.name);
    if (!name) return { rows, error: "Every reward tier needs a name." };
    if (name.length > 80) return { rows, error: `Keep "${name.slice(0, 24)}…" under 80 characters.` };
    const description = text(t.description);
    if (description.length > 500) return { rows, error: `Keep the description on "${name}" under 500 characters.` };
    if (!UUID.test(t.id)) return { rows, error: "A reward tier has an invalid id. Reload and try again." };

    if (t.recipients !== "ranks" && t.recipients !== "award") {
      return { rows, error: `"${name}" has an unknown winner rule.` };
    }
    const award = t.recipients === "award";
    const winnerCount = Number(t.winnerCount);
    if (award && !(Number.isInteger(winnerCount) && winnerCount >= 1 && winnerCount <= 50)) {
      return { rows, error: `"${name}" needs 1–50 winners.` };
    }
    if (award && t.pick !== "manual" && t.pick !== "criterion") return { rows, error: `"${name}" has an unknown pick rule.` };
    if (award && t.pick === "criterion" && !(t.criterionId && UUID.test(t.criterionId))) {
      return { rows, error: `Pick the criterion that suggests winners for "${name}".` };
    }
    const ranks = t.recipients === "ranks";
    const from = Number(t.rankFrom);
    const to = Number(t.rankTo);
    if (ranks && !(Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= 1000 && from <= to)) {
      return { rows, error: `Set a rank range for "${name}", like 1 to 3.` };
    }

    // Prize images must be ones this editor uploaded: <hackathon>/<tier>/<uuid>.webp.
    const imagePath = t.imagePath || null;
    const folder = `${hackathonId}/${t.id}/`;
    if (imagePath && !(imagePath.startsWith(folder) && imagePath.endsWith(".webp") && UUID.test(imagePath.slice(folder.length, -5)))) {
      return { rows, error: `The image on "${name}" didn't upload properly. Try again.` };
    }

    if (t.items.length > 30) return { rows, error: `Thirty prizes is the most for "${name}".` };
    const items: Record<string, unknown>[] = [];
    for (const it of t.items) {
      const label = text(it.label);
      const detail = text(it.detail);
      if (!label) return { rows, error: `Every prize on "${name}" needs a label.` };
      if (label.length > 200) return { rows, error: `Keep "${label.slice(0, 24)}…" under 200 characters.` };
      if (detail.length > 2000) return { rows, error: `Keep the details for "${label.slice(0, 24)}" under 2000 characters.` };
      if (!KINDS.has(it.kind)) return { rows, error: `"${label}" has an unknown prize type.` };
      if (!UUID.test(it.id)) return { rows, error: "A prize has an invalid id. Reload and try again." };
      items.push({ id: it.id, kind: it.kind, label, detail });
    }

    rows.push({
      id: t.id,
      name,
      description,
      recipients: t.recipients,
      rank_from: ranks ? from : null,
      rank_to: ranks ? to : null,
      winner_count: award ? winnerCount : null,
      pick: award ? t.pick : null,
      criterion_id: award && t.pick === "criterion" ? t.criterionId : null,
      exclusive: Boolean(t.exclusive),
      image_path: imagePath,
      items,
    });
  }
  return { rows };
}

/** Replace the hackathon's reward tiers with `tiers`, in order. */
export async function saveRewardTiers(slug: string, tiers: RewardTier[]): Promise<SaveRewardsResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const { rows, error } = clean(hackathon.id, tiers);
  if (error) return { error };

  const supabase = await createClient();
  // Note the current images so replaced and deleted ones can be removed after.
  const { data: before } = await supabase
    .from("reward_tiers")
    .select("image_path")
    .eq("hackathon_id", hackathon.id)
    .not("image_path", "is", null);

  const { error: saveError } = await supabase.rpc("save_reward_tiers", {
    p_hackathon_id: hackathon.id,
    p_tiers: rows,
  });
  if (saveError) return { error: saveError.message };

  const kept = new Set(rows.map((r) => r.image_path));
  const stale = (before ?? []).map((r) => r.image_path as string).filter((p) => !kept.has(p));
  if (stale.length) await supabase.storage.from(REWARD_IMAGE_BUCKET).remove(stale);

  revalidatePath(`/h/${slug}`, "layout");
  return { items: await listRewardTiers(hackathon.id) };
}

export type SaveRewardEmailResult = { error: string } | { email: RewardEmail };

const EMAIL_LIMITS: [keyof RewardEmail, string, number][] = [
  ["fromName", "from name", 80],
  ["title", "title", 200],
  ["description", "description", 2000],
  ["linkUrl", "link", 2000],
  ["linkLabel", "link name", 60],
  ["finePrint", "fine print", 2000],
];

/** Save the hackathon's winner email settings. */
export async function saveRewardEmail(slug: string, input: RewardEmail): Promise<SaveRewardEmailResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const email = { ...emptyRewardEmail };
  for (const [key, name, max] of EMAIL_LIMITS) {
    email[key] = text(input[key]);
    if (email[key].length > max) return { error: `Keep the ${name} under ${max} characters.` };
  }
  if (email.linkUrl) {
    let url: URL | null = null;
    try {
      url = new URL(email.linkUrl);
    } catch {}
    if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
      return { error: "The link should be a full URL starting with https://" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reward_emails").upsert({
    hackathon_id: hackathon.id,
    from_name: email.fromName,
    title: email.title,
    description: email.description,
    link_url: email.linkUrl,
    link_label: email.linkLabel,
    fine_print: email.finePrint,
  });
  if (error) return { error: error.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { email };
}

export type SaveRewardSettingsResult = { error: string } | { settings: RewardSettings };

/** Save the hackathon's reward rules. */
export async function saveRewardSettings(slug: string, input: RewardSettings): Promise<SaveRewardSettingsResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const settings: RewardSettings = { oneWinPerEntrant: input.oneWinPerEntrant === true };
  const supabase = await createClient();
  const { error } = await supabase.from("reward_settings").upsert({
    hackathon_id: hackathon.id,
    one_win_per_entrant: settings.oneWinPerEntrant,
  });
  if (error && MISSING_TABLE.has(error.code)) {
    return { error: "Reward settings need a database update first (the reward_settings migration)." };
  }
  if (error) return { error: error.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { settings };
}
