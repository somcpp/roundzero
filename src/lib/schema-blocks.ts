import type { SchemaBlock } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Columns of public.schema_blocks (supabase/migrations/*_create_schema_blocks.sql) the app reads. */
const COLUMNS = "id, title, type, description, expected";

/** A hackathon's project schema, in form order. RLS limits it to the owner. */
export async function listSchemaBlocks(hackathonId: string): Promise<SchemaBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schema_blocks")
    .select(COLUMNS)
    .eq("hackathon_id", hackathonId)
    .order("position")
    .returns<SchemaBlock[]>();
  if (error) throw new Error(`Couldn't load the project schema: ${error.message}`);
  return data;
}
