"use server";

import { revalidatePath } from "next/cache";
import { emptyThankYouEmail, rewardIcon, type RewardItem, type ThankYouEmailSettings } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { MISSING_TABLE } from "@/lib/rewards";
import { createClient } from "@/lib/supabase/server";

export type SaveThankYouEmailResult = { error: string } | { email: ThankYouEmailSettings };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(Object.keys(rewardIcon));
/** Gift kinds whose detail is a URL the email links to. */
const LINKED = new Set(["link", "file", "image"]);
/** supabase/migrations/*_thank_you_emails.sql allows this many gift items. */
const MAX_GIFT_ITEMS = 10;

const text = (v: unknown) => String(v ?? "").trim();

const isWebUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

type TextField = Exclude<keyof ThankYouEmailSettings, "enabled" | "showWinners" | "giftItems">;

const TEXT_LIMITS: [TextField, string, number][] = [
  ["fromName", "from name", 80],
  ["subject", "subject", 200],
  ["title", "title", 200],
  ["message", "message", 2000],
  ["giftTitle", "gift title", 120],
  ["giftDescription", "gift description", 500],
  ["linkUrl", "link", 2000],
  ["linkLabel", "link name", 60],
  ["finePrint", "fine print", 2000],
];

function cleanGiftItems(input: RewardItem[]): { items: RewardItem[]; error?: string } {
  const items: RewardItem[] = [];
  if (!Array.isArray(input)) return { items, error: "The gift didn't come through. Reload and try again." };
  if (input.length > MAX_GIFT_ITEMS) return { items, error: "Ten gift items is the most." };
  for (const it of input) {
    const label = text(it.label);
    const detail = text(it.detail);
    if (!label) return { items, error: "Every gift item needs a label." };
    if (label.length > 200) return { items, error: `Keep "${label.slice(0, 24)}…" under 200 characters.` };
    if (detail.length > 2000) return { items, error: `Keep the details for "${label.slice(0, 24)}" under 2000 characters.` };
    if (!KINDS.has(it.kind)) return { items, error: `"${label}" has an unknown type.` };
    if (!UUID.test(it.id)) return { items, error: "A gift item has an invalid id. Reload and try again." };
    if (LINKED.has(it.kind) && detail && !isWebUrl(detail)) {
      return { items, error: `The link for "${label.slice(0, 24)}" should be a full URL starting with https://` };
    }
    items.push({ id: it.id, kind: it.kind, label, detail: LINKED.has(it.kind) || it.kind === "code" || it.kind === "credits" ? detail : "" });
  }
  return { items };
}

/** Save the hackathon's thank-you email settings. */
export async function saveThankYouEmail(slug: string, input: ThankYouEmailSettings): Promise<SaveThankYouEmailResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };

  const email: ThankYouEmailSettings = {
    ...emptyThankYouEmail,
    enabled: input.enabled !== false,
    showWinners: input.showWinners !== false,
  };
  for (const [key, name, max] of TEXT_LIMITS) {
    const value = text(input[key]);
    if (value.length > max) return { error: `Keep the ${name} under ${max} characters.` };
    email[key] = value;
  }
  if (email.linkUrl && !isWebUrl(email.linkUrl)) return { error: "The button link should be a full URL starting with https://" };

  const gift = cleanGiftItems(input.giftItems);
  if (gift.error) return { error: gift.error };
  email.giftItems = gift.items;

  const supabase = await createClient();
  const { error } = await supabase.from("thank_you_emails").upsert({
    hackathon_id: hackathon.id,
    enabled: email.enabled,
    from_name: email.fromName,
    subject: email.subject,
    title: email.title,
    message: email.message,
    show_winners: email.showWinners,
    gift_title: email.giftTitle,
    gift_description: email.giftDescription,
    gift_items: email.giftItems,
    link_url: email.linkUrl,
    link_label: email.linkLabel,
    fine_print: email.finePrint,
  });
  if (error && MISSING_TABLE.has(error.code)) {
    return { error: "The thank-you email needs a database update first (the thank_you_emails migration)." };
  }
  if (error) return { error: error.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { email };
}
