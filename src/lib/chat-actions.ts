"use server";

import { revalidatePath } from "next/cache";
import { getHackathon } from "@/lib/hackathons";
import { getIndexStatus, indexProjects, type IndexStatus } from "@/lib/project-index";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

export type ReindexResult = { error: string } | { status: IndexStatus; indexed: number; failed: number };

/**
 * Embed projects for the chat's search: the ones missing or out of date, or
 * every project with `all`.
 */
export async function reindexProjects(slug: string, all = false): Promise<ReindexResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const blocks = await listSchemaBlocks(hackathon.id);

  let ids: string[];
  if (all) {
    const { data, error } = await supabase.from("projects").select("id").eq("hackathon_id", hackathon.id);
    if (error) return { error: error.message };
    ids = data.map((p) => p.id as string);
  } else {
    ids = (await getIndexStatus(hackathon.id)).stale;
  }

  const { indexed, failed } = await indexProjects(hackathon.id, ids, { blocks });
  return { status: await getIndexStatus(hackathon.id), indexed, failed };
}

export type ThreadActionResult = { error: string } | { ok: true };

export async function renameThread(slug: string, id: string, title: string): Promise<ThreadActionResult> {
  const name = title.replace(/\s+/g, " ").trim();
  if (!name) return { error: "Give the chat a name." };
  if (name.length > 120) return { error: "Keep the name under 120 characters." };
  if (!UUID.test(id)) return { error: "Invalid chat." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const { error } = await supabase.from("chat_threads").update({ title: name }).eq("id", id).eq("hackathon_id", hackathon.id);
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}/judging/chat`);
  return { ok: true };
}

export async function deleteThread(slug: string, id: string): Promise<ThreadActionResult> {
  if (!UUID.test(id)) return { error: "Invalid chat." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const { error } = await supabase.from("chat_threads").delete().eq("id", id).eq("hackathon_id", hackathon.id);
  if (error) return { error: error.message };
  revalidatePath(`/h/${slug}/judging/chat`);
  return { ok: true };
}
