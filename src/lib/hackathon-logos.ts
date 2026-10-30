import { createClient } from "@/lib/supabase/client";

// Hackathon logos live in the public hackathon-logos bucket at
// <hackathon_id>/<random>.webp (see migrations/*_add_hackathon_logo_image.sql).
export const HACKATHON_LOGO_BUCKET = "hackathon-logos";

const MAX_SIDE = 512;

export function hackathonLogoUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${HACKATHON_LOGO_BUCKET}/${path}`;
}

// An <img> rather than createImageBitmap, so SVG logos decode too.
function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url)) as Promise<HTMLImageElement>;
}

/** Fit within 512px, keep transparency, and re-encode as WebP. */
async function shrink(file: File): Promise<Blob> {
  const img = await loadImage(file);
  // SVGs without intrinsic dimensions report 0; render them at full size.
  const w = img.naturalWidth || MAX_SIDE;
  const h = img.naturalHeight || MAX_SIDE;
  const scale = file.type === "image/svg+xml" ? MAX_SIDE / Math.max(w, h) : Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/webp", 0.9),
  );
}

/**
 * Upload a logo straight from the browser (the storage policies check the
 * signed-in user owns the hackathon). Returns the object path, or an error.
 */
export async function uploadHackathonLogo(hackathonId: string, file: File): Promise<{ path: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 20 * 1024 * 1024) return { error: "Pick an image under 20 MB." };

  let blob: Blob;
  try {
    blob = await shrink(file);
  } catch {
    return { error: "Couldn't read that image. Try a PNG, JPEG or SVG." };
  }

  const path = `${hackathonId}/${crypto.randomUUID()}.webp`;
  const { error } = await createClient()
    .storage.from(HACKATHON_LOGO_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) return { error: `Upload failed: ${error.message}` };
  return { path };
}

/** Best-effort cleanup of a logo that was uploaded but never saved. */
export async function discardHackathonLogo(path: string) {
  await createClient().storage.from(HACKATHON_LOGO_BUCKET).remove([path]);
}
