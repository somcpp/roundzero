"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { JudgeDirectory, JudgeField, JudgeGroup, JudgePortalSettings, JudgeProfile } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { JUDGE_IMAGE_BUCKET } from "@/lib/judge-images";
import { getPortalSettings } from "@/lib/judge-portal";
import { listJudgeDirectory } from "@/lib/judges";
import { createClient } from "@/lib/supabase/server";

export type JudgeActionResult = { error: string } | { directory: JudgeDirectory };

/** An option typed into the judge form that doesn't exist yet. */
export type NewFieldOption = { fieldId: string; id: string; label: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const text = (v: unknown) => String(v ?? "").trim();

async function owned(slug: string) {
  const hackathon = await getHackathon(slug);
  return hackathon ? { hackathon, supabase: await createClient() } : null;
}

async function done(slug: string, hackathonId: string): Promise<JudgeActionResult> {
  revalidatePath(`/h/${slug}`, "layout");
  return { directory: await listJudgeDirectory(hackathonId) };
}

/** Create or update a judge, with their field values, groups and photo. */
export async function saveJudge(
  slug: string,
  judge: JudgeProfile & { groups: string[] },
  newOptions: NewFieldOption[] = [],
): Promise<JudgeActionResult> {
  const name = text(judge.name);
  const title = text(judge.title);
  const email = text(judge.email).toLowerCase();
  if (!name) return { error: "Give the judge a name." };
  if (name.length > 120) return { error: "Keep the name under 120 characters." };
  if (title.length > 160) return { error: "Keep the title under 160 characters." };
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: "That email doesn't look right." };
  if (
    !UUID.test(judge.id) ||
    !Object.entries(judge.values).every(([f, o]) => UUID.test(f) && UUID.test(o)) ||
    !judge.groups.every((g) => UUID.test(g)) ||
    !newOptions.every((o) => UUID.test(o.id) && UUID.test(o.fieldId))
  ) {
    return { error: "Something on this judge has an invalid id. Reload and try again." };
  }
  const labels = newOptions.map((o) => ({ ...o, label: text(o.label) }));
  if (labels.some((o) => !o.label || o.label.length > 80)) return { error: "Options need a label under 80 characters." };

  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  const { hackathon, supabase } = ctx;

  // Photos must sit in this judge's folder; anything else is refused.
  const imagePath = judge.imagePath || null;
  const folder = `${hackathon.id}/${judge.id}/`;
  if (imagePath && !(imagePath.startsWith(folder) && UUID.test(imagePath.slice(folder.length, -5)) && imagePath.endsWith(".webp"))) {
    return { error: "That photo didn't upload properly. Try again." };
  }

  if (labels.length) {
    const { data: existing, error } = await supabase
      .from("judge_field_options")
      .select("field_id")
      .in("field_id", [...new Set(labels.map((o) => o.fieldId))]);
    if (error) return { error: error.message };
    const next = new Map<string, number>();
    for (const o of existing) next.set(o.field_id, (next.get(o.field_id) ?? 0) + 1);
    const rows = labels.map((o) => {
      const position = next.get(o.fieldId) ?? 0;
      next.set(o.fieldId, position + 1);
      return { id: o.id, field_id: o.fieldId, label: o.label, position };
    });
    const { error: insertError } = await supabase.from("judge_field_options").insert(rows);
    if (insertError) return { error: insertError.message };
  }

  const { data: before } = await supabase.from("judges").select("image_path").eq("id", judge.id).maybeSingle();

  const { error } = await supabase.rpc("save_judge", {
    p_hackathon_id: hackathon.id,
    p_judge: { id: judge.id, name, title, email, image_path: imagePath, values: judge.values, groups: judge.groups },
  });
  if (error) {
    if (error.code === "23505") return { error: `Another judge already uses ${email}.` };
    return { error: error.message };
  }

  // The old photo is replaced or removed; don't leave it in the bucket.
  if (before?.image_path && before.image_path !== imagePath) {
    await supabase.storage.from(JUDGE_IMAGE_BUCKET).remove([before.image_path]);
  }
  return done(slug, hackathon.id);
}

export async function deleteJudge(slug: string, id: string): Promise<JudgeActionResult> {
  if (!UUID.test(id)) return { error: "Invalid judge id." };
  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  const { hackathon, supabase } = ctx;
  // Deleting a judge deletes their assignments, and the scores with them.
  if (hackathon.judgingStartedAt) {
    const { count, error: countError } = await supabase
      .from("judge_assignments")
      .select("id", { count: "exact", head: true })
      .eq("judge_id", id);
    if (countError) return { error: countError.message };
    if (count) return { error: "Judging has started and this judge has reviews, so they can't be deleted. Reset judging first." };
  }

  const { data, error } = await supabase
    .from("judges")
    .delete()
    .eq("id", id)
    .eq("hackathon_id", hackathon.id)
    .select("image_path")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.image_path) await supabase.storage.from(JUDGE_IMAGE_BUCKET).remove([data.image_path]);
  return done(slug, hackathon.id);
}

/** Replace the hackathon's custom judge fields and their options, in order. */
export async function saveJudgeFields(slug: string, fields: JudgeField[]): Promise<JudgeActionResult> {
  const rows: { id: string; name: string; options: { id: string; label: string }[] }[] = [];
  const names = new Set<string>();
  for (const f of fields) {
    const name = text(f.name);
    if (!name) return { error: "Every field needs a name." };
    if (name.length > 60) return { error: `Keep "${name.slice(0, 24)}…" under 60 characters.` };
    if (names.has(name.toLowerCase())) return { error: `There are two fields called "${name}".` };
    names.add(name.toLowerCase());
    const labels = new Set<string>();
    const options = [];
    for (const o of f.options) {
      const label = text(o.label);
      if (!label) return { error: `An option on "${name}" is empty.` };
      if (label.length > 80) return { error: `Keep options on "${name}" under 80 characters.` };
      if (labels.has(label.toLowerCase())) return { error: `"${name}" has "${label}" twice.` };
      labels.add(label.toLowerCase());
      if (!UUID.test(o.id)) return { error: "An option has an invalid id. Reload and try again." };
      options.push({ id: o.id, label });
    }
    if (!UUID.test(f.id)) return { error: "A field has an invalid id. Reload and try again." };
    rows.push({ id: f.id, name, options });
  }

  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  const { error } = await ctx.supabase.rpc("save_judge_fields", { p_hackathon_id: ctx.hackathon.id, p_fields: rows });
  if (error) return { error: error.message };
  return done(slug, ctx.hackathon.id);
}

export async function saveJudgeGroup(slug: string, group: JudgeGroup): Promise<JudgeActionResult> {
  const name = text(group.name);
  if (!name) return { error: "Give the group a name." };
  if (name.length > 60) return { error: "Keep the group name under 60 characters." };
  if (!UUID.test(group.id) || !group.members.every((m) => UUID.test(m))) {
    return { error: "This group has an invalid id. Reload and try again." };
  }

  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  const { error } = await ctx.supabase.rpc("save_judge_group", {
    p_hackathon_id: ctx.hackathon.id,
    p_group: { id: group.id, name, members: group.members },
  });
  if (error) return { error: error.message };
  return done(slug, ctx.hackathon.id);
}

export async function deleteJudgeGroup(slug: string, id: string): Promise<JudgeActionResult> {
  if (!UUID.test(id)) return { error: "Invalid group id." };
  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  // A phase whose group is deleted falls back to all judges, which would change a phase that's locked.
  if (ctx.hackathon.judgingStartedAt) {
    const { count, error: countError } = await ctx.supabase
      .from("judging_phases")
      .select("id", { count: "exact", head: true })
      .eq("hackathon_id", ctx.hackathon.id)
      .eq("judge_group_id", id);
    if (countError) return { error: countError.message };
    if (count) return { error: "Judging has started and a phase uses this group, so it can't be deleted. Reset judging first." };
  }
  const { error } = await ctx.supabase.from("judge_groups").delete().eq("id", id).eq("hackathon_id", ctx.hackathon.id);
  if (error) return { error: error.message };
  return done(slug, ctx.hackathon.id);
}

// ── Judge links ───────────────────────────────────────────────────────────

/** Give a judge a new private link. Their old link stops working straight away. */
export async function regenerateJudgeLink(slug: string, id: string): Promise<JudgeActionResult> {
  if (!UUID.test(id)) return { error: "Invalid judge id." };
  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  const { data, error } = await ctx.supabase
    .from("judges")
    .update({ access_token: randomBytes(24).toString("base64url") })
    .eq("id", id)
    .eq("hackathon_id", ctx.hackathon.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data.length) return { error: "Judge not found. Reload and try again." };
  return done(slug, ctx.hackathon.id);
}

export type PortalSettingsResult = { error: string } | { settings: JudgePortalSettings };

/** Save what judges see on their link's start and end screens. */
export async function savePortalSettings(slug: string, s: JudgePortalSettings): Promise<PortalSettingsResult> {
  const welcomeTitle = text(s.welcomeTitle);
  const welcomeMessage = text(s.welcomeMessage);
  const doneMessage = text(s.doneMessage);
  const goals = (Array.isArray(s.goals) ? s.goals : []).map(text).filter(Boolean);
  if (welcomeTitle.length > 120) return { error: "Keep the headline under 120 characters." };
  if (welcomeMessage.length > 2000) return { error: "Keep the welcome message under 2000 characters." };
  if (doneMessage.length > 1000) return { error: "Keep the finish message under 1000 characters." };
  if (goals.length > 8) return { error: "Eight goals is the most." };
  if (goals.some((g) => g.length > 200)) return { error: "Keep each goal under 200 characters." };

  const ctx = await owned(slug);
  if (!ctx) return { error: "Hackathon not found, or your session expired." };
  const { error } = await ctx.supabase.from("judge_portal_settings").upsert({
    hackathon_id: ctx.hackathon.id,
    welcome_title: welcomeTitle,
    welcome_message: welcomeMessage,
    goals,
    done_message: doneMessage,
  });
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}`, "layout");
  return { settings: await getPortalSettings(ctx.hackathon.id) };
}
