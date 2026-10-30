"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Stage } from "@/lib/data";
import { DEMO_READ_ONLY } from "@/lib/demo";
import { STAGES } from "@/lib/format-hackathon";
import { HACKATHON_BANNER_BUCKET } from "@/lib/hackathon-banners";
import { HACKATHON_LOGO_BUCKET } from "@/lib/hackathon-logos";
import { createClient } from "@/lib/supabase/server";

export type HackathonFormState = { error?: string; saved?: boolean } | undefined;

type Fields = {
  name?: string;
  tagline?: string;
  starts_on?: string | null;
  ends_on?: string | null;
  stage?: Stage;
  color?: string;
  logo?: string | null;
  logo_path?: string | null;
  banner_path?: string | null;
  published?: boolean;
};

// Uploaded images, and the bucket each one's file lives in.
const IMAGES = [
  { column: "logo_path", bucket: HACKATHON_LOGO_BUCKET },
  { column: "banner_path", bucket: HACKATHON_BANNER_BUCKET },
] as const;

const HEX = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// <hackathon_id>/<uuid>.webp, as written by uploadHackathonLogo and
// uploadHackathonBanner. The database also checks the folder is this
// hackathon's own.
const IMAGE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

// Reads only the fields present in the form, so each form (details, branding)
// can update its own subset of columns.
function parseFields(formData: FormData): { fields: Fields; error?: string } {
  const fields: Fields = {};
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.trim() : undefined;
  };

  const name = text("name");
  if (name !== undefined) {
    if (!name) return { fields, error: "Give the hackathon a name." };
    if (name.length > 120) return { fields, error: "Keep the name under 120 characters." };
    fields.name = name;
  }

  const tagline = text("tagline");
  if (tagline !== undefined) {
    if (tagline.length > 200) return { fields, error: "Keep the tagline under 200 characters." };
    fields.tagline = tagline;
  }

  for (const key of ["starts_on", "ends_on"] as const) {
    const v = text(key);
    if (v === undefined) continue;
    if (v && !DATE.test(v)) return { fields, error: "Dates must be valid calendar dates." };
    fields[key] = v || null;
  }
  if (fields.starts_on && fields.ends_on && fields.ends_on < fields.starts_on) {
    return { fields, error: "The end date can't be before the start date." };
  }

  const stage = text("stage");
  if (stage !== undefined) {
    if (!STAGES.includes(stage as Stage)) return { fields, error: "Pick a valid stage." };
    fields.stage = stage as Stage;
  }

  const color = text("color");
  if (color !== undefined) {
    if (!HEX.test(color)) return { fields, error: "Color must be a hex like #6e56e7." };
    fields.color = color.toLowerCase();
  }

  const logo = text("logo");
  if (logo !== undefined) {
    if (logo.length > 3) return { fields, error: "Logo initials can be up to 3 letters." };
    fields.logo = logo.toUpperCase() || null;
  }

  const logoPath = text("logo_path");
  if (logoPath !== undefined) {
    if (logoPath && !IMAGE_PATH.test(logoPath)) return { fields, error: "That logo upload isn't valid. Upload it again." };
    fields.logo_path = logoPath || null;
  }

  const bannerPath = text("banner_path");
  if (bannerPath !== undefined) {
    if (bannerPath && !IMAGE_PATH.test(bannerPath)) return { fields, error: "That banner upload isn't valid. Upload it again." };
    fields.banner_path = bannerPath || null;
  }

  // Checkboxes only submit when checked; a hidden "published_present" marks the field as in the form.
  if (formData.has("published_present")) fields.published = formData.get("published") === "on";

  return { fields };
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/, "") || "hackathon"
  );
}

const UNIQUE_VIOLATION = "23505";

export async function createHackathon(_prev: HackathonFormState, formData: FormData): Promise<HackathonFormState> {
  const { fields, error } = parseFields(formData);
  if (error) return { error };
  if (!fields.name) return { error: "Give the hackathon a name." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Your session expired. Sign in again." };
  // The database refuses these too; this just says why.
  if (claims.claims.app_metadata?.demo === true) return { error: DEMO_READ_ONLY };

  // Slugs are global (they're in public URLs), so add a short suffix on collision.
  const base = slugify(fields.name);
  let slug = base;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error: insertError } = await supabase.from("hackathons").insert({ ...fields, slug });
    if (!insertError) {
      revalidatePath("/");
      redirect(`/h/${slug}/setup/schema`);
    }
    if (insertError.code !== UNIQUE_VIOLATION) return { error: insertError.message };
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return { error: "Couldn't find a free URL for that name. Try a different one." };
}

export async function updateHackathon(
  slug: string,
  _prev: HackathonFormState,
  formData: FormData,
): Promise<HackathonFormState> {
  const { fields, error } = parseFields(formData);
  if (error) return { error };
  if (Object.keys(fields).length === 0) return { saved: true };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Your session expired. Sign in again." };

  // Note the current images this save changes, so their files can be removed
  // once replaced. The branding form only sends banner_path when it changed.
  const images = IMAGES.filter(({ column }) => fields[column] !== undefined);
  let previous: { logo_path?: string | null; banner_path?: string | null } = {};
  if (images.length) {
    const { data: current } = await supabase
      .from("hackathons")
      .select(images.map((i) => i.column).join(", "))
      .eq("slug", slug)
      .maybeSingle<typeof previous>();
    previous = current ?? {};
  }

  // RLS limits updates to the owner; a non-owner gets zero rows back.
  const { data, error: updateError } = await supabase
    .from("hackathons")
    .update(fields)
    .eq("slug", slug)
    .select("id");
  if (updateError) return { error: updateError.message };
  if (!data.length) return { error: "Hackathon not found." };

  for (const { column, bucket } of images) {
    const old = previous[column];
    // Best effort: an orphaned file is harmless.
    if (old && old !== fields[column]) await supabase.storage.from(bucket).remove([old]);
  }

  revalidatePath("/");
  revalidatePath(`/h/${slug}`, "layout");
  revalidatePath(`/w/${slug}`);
  return { saved: true };
}

export async function deleteHackathon(slug: string): Promise<HackathonFormState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Your session expired. Sign in again." };

  const { data, error } = await supabase.from("hackathons").delete().eq("slug", slug).select("id");
  if (error) return { error: error.message };
  if (!data.length) return { error: "Hackathon not found." };

  revalidatePath("/");
  redirect("/");
}
