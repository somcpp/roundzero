import type { JudgeDirectory } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Rows from supabase/migrations/*_create_judges.sql, with their children embedded. */
type JudgeRow = {
  id: string;
  name: string;
  title: string;
  email: string;
  image_path: string | null;
  access_token: string;
  judge_field_values: { field_id: string; option_id: string }[];
};

type FieldRow = {
  id: string;
  name: string;
  judge_field_options: { id: string; label: string }[];
};

type GroupRow = {
  id: string;
  name: string;
  judge_group_members: { judge_id: string }[];
};

/** A hackathon's judges, custom fields and saved groups. RLS limits it to the owner. */
export async function listJudgeDirectory(hackathonId: string): Promise<JudgeDirectory> {
  const supabase = await createClient();
  const [judges, fields, groups] = await Promise.all([
    supabase
      .from("judges")
      .select("id, name, title, email, image_path, access_token, judge_field_values(field_id, option_id)")
      .eq("hackathon_id", hackathonId)
      .order("name")
      .returns<JudgeRow[]>(),
    supabase
      .from("judge_fields")
      .select("id, name, judge_field_options(id, label)")
      .eq("hackathon_id", hackathonId)
      .order("position")
      .order("position", { referencedTable: "judge_field_options" })
      .returns<FieldRow[]>(),
    supabase
      .from("judge_groups")
      .select("id, name, judge_group_members(judge_id)")
      .eq("hackathon_id", hackathonId)
      .order("name")
      .returns<GroupRow[]>(),
  ]);
  const error = judges.error ?? fields.error ?? groups.error;
  if (error) throw new Error(`Couldn't load judges: ${error.message}`);

  return {
    judges: judges.data!.map((j) => ({
      id: j.id,
      name: j.name,
      title: j.title,
      email: j.email,
      imagePath: j.image_path,
      values: Object.fromEntries(j.judge_field_values.map((v) => [v.field_id, v.option_id])),
      accessToken: j.access_token,
    })),
    fields: fields.data!.map((f) => ({ id: f.id, name: f.name, options: f.judge_field_options })),
    groups: groups.data!.map((g) => ({
      id: g.id,
      name: g.name,
      members: g.judge_group_members.map((m) => m.judge_id),
    })),
  };
}
