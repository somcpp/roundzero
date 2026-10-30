import { createClient } from "@/lib/supabase/client";

// Judge photos live in the public judge-images bucket at
// <hackathon_id>/<judge_id>/<random>.webp (see migrations/*_create_judges.sql).
export const JUDGE_IMAGE_BUCKET = "judge-images";

const MAX_SIDE = 512;

export function judgeImageUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${JUDGE_IMAGE_BUCKET}/${path}`;
}

/** Downscale to at most 512px on the long side and re-encode as WebP. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/webp", 0.85),
  );
}

/**
 * Upload a judge photo straight from the browser (the storage policies check
 * the signed-in user owns the hackathon). Returns the object path, or an error.
 */
export async function uploadJudgeImage(
  hackathonId: string,
  judgeId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 20 * 1024 * 1024) return { error: "Pick an image under 20 MB." };

  let blob: Blob;
  try {
    blob = await shrink(file);
  } catch {
    return { error: "Couldn't read that image. Try a PNG or JPEG." };
  }

  const path = `${hackathonId}/${judgeId}/${crypto.randomUUID()}.webp`;
  const { error } = await createClient()
    .storage.from(JUDGE_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) return { error: `Upload failed: ${error.message}` };
  return { path };
}

/** Best-effort cleanup of a photo that was uploaded but never saved. */
export async function discardJudgeImage(path: string) {
  await createClient().storage.from(JUDGE_IMAGE_BUCKET).remove([path]);
}
