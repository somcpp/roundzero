"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getHackathon } from "@/lib/hackathons";
import { getIntakeSettings, hashKey, type IntakeSettings } from "@/lib/intake";
import { API_KEY_PREFIX } from "@/lib/intake-shape";
import { createClient } from "@/lib/supabase/server";

// Switch the intake API and submission form on and off, and rotate their
// credentials. Runs as the owner, so RLS on public.intake_settings decides.

/** `key` is the new API key in full. It's only ever returned here, once. */
export type IntakeActionResult = { error: string } | { settings: IntakeSettings; key?: string };

const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

const newApiKey = () => `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
const newFormToken = () => randomBytes(12).toString("base64url");

async function save(
  slug: string,
  change: (current: IntakeSettings) => { row: Record<string, unknown>; key?: string },
): Promise<IntakeActionResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const current = await getIntakeSettings(hackathon.id);
  const { row, key } = change(current);
  const supabase = await createClient();
  const { error } = await supabase.from("intake_settings").upsert({ hackathon_id: hackathon.id, ...row });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}/judging/projects`);
  return { settings: await getIntakeSettings(hackathon.id), key };
}

function apiKeyRow(key: string) {
  return { api_key_hash: hashKey(key), api_key_hint: key.slice(-4), api_key_created_at: new Date().toISOString() };
}

/** Turn the API on or off. The first time it's turned on, a key is made. */
export async function setApiEnabled(slug: string, enabled: boolean) {
  return save(slug, (s) => {
    if (!enabled || s.apiKeyHint) return { row: { api_enabled: enabled } };
    const key = newApiKey();
    return { row: { api_enabled: true, ...apiKeyRow(key) }, key };
  });
}

/** Replace the API key. The old one stops working straight away. */
export async function regenerateApiKey(slug: string) {
  return save(slug, () => {
    const key = newApiKey();
    return { row: apiKeyRow(key), key };
  });
}

/** Open or close the public submission form. Its link is made the first time. */
export async function setFormEnabled(slug: string, enabled: boolean) {
  return save(slug, (s) => ({
    row: { form_enabled: enabled, ...(enabled && !s.formToken && { form_token: newFormToken() }) },
  }));
}

/** Give the form a new link. The old link stops working straight away. */
export async function regenerateFormLink(slug: string) {
  return save(slug, () => ({ row: { form_token: newFormToken() } }));
}
