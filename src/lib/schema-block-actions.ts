"use server";

import { revalidatePath } from "next/cache";
import { blockTypes, type SchemaBlock } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

export type SaveSchemaResult = { error: string } | { items: SchemaBlock[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set<string>(blockTypes.map((t) => t.type));

function clean(blocks: SchemaBlock[]): { blocks: SchemaBlock[]; error?: string } {
  const out: SchemaBlock[] = [];
  for (const b of blocks) {
    const title = String(b.title ?? "").trim();
    if (!title) return { blocks: out, error: "Every block needs a title." };
    if (title.length > 120) return { blocks: out, error: `Keep "${title.slice(0, 24)}…" under 120 characters.` };
    if (!TYPES.has(b.type)) return { blocks: out, error: `"${title}" has an unknown type.` };
    const description = String(b.description ?? "").trim();
    const expected = String(b.expected ?? "").trim();
    if (description.length > 2000 || expected.length > 2000) {
      return { blocks: out, error: `Keep the text on "${title}" under 2000 characters.` };
    }
    if (!UUID.test(b.id)) return { blocks: out, error: "A block has an invalid id. Reload and try again." };
    out.push({ id: b.id, title, type: b.type, description, expected });
  }
  return { blocks: out };
}

/** Replace the hackathon's project schema with `blocks`, in order. */
export async function saveSchemaBlocks(slug: string, blocks: SchemaBlock[]): Promise<SaveSchemaResult> {
  const { blocks: cleaned, error } = clean(blocks);
  if (error) return { error };

  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };
  // Once judging starts only titles can change: projects were submitted, and
  // agents check them, against everything else.
  if (hackathon.judgingStartedAt) {
    const shape = (bs: SchemaBlock[]) => JSON.stringify(bs.map((b) => [b.id, b.type, b.description, b.expected]));
    if (shape(cleaned) !== shape(clean(await listSchemaBlocks(hackathon.id)).blocks)) {
      return { error: "Judging has started, so only block titles can change. Reset judging to change the rest." };
    }
  }

  const supabase = await createClient();
  const { error: saveError } = await supabase.rpc("save_schema_blocks", {
    p_hackathon_id: hackathon.id,
    p_blocks: cleaned,
  });
  if (saveError) return { error: saveError.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { items: await listSchemaBlocks(hackathon.id) };
}
