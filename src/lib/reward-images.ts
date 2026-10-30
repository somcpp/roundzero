import { createClient } from "@/lib/supabase/client";

// Prize images live in the public reward-images bucket at
// <hackathon_id>/<tier_id>/<random>.webp (see migrations/*_create_rewards.sql).
export const REWARD_IMAGE_BUCKET = "reward-images";

const SIDE = 512;

export function rewardImageUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${REWARD_IMAGE_BUCKET}/${path}`;
}

// An <img> rather than createImageBitmap, so SVGs decode too.
function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/** Center-crop to a square, scale to 512px (up for SVGs, never up for bitmaps), keep transparency, and re-encode as WebP. */
async function squareCrop(file: File): Promise<Blob> {
  const img = await loadImage(file);
  // SVGs without intrinsic dimensions report 0; render them at full size.
  const w = img.naturalWidth || SIDE;
  const h = img.naturalHeight || SIDE;
  const crop = Math.min(w, h);
  const side = file.type === "image/svg+xml" ? SIDE : Math.min(SIDE, crop);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  canvas.getContext("2d")!.drawImage(img, (w - crop) / 2, (h - crop) / 2, crop, crop, 0, 0, side, side);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/webp", 0.9),
  );
}

/**
 * Upload a prize image straight from the browser (the storage policies check
 * the signed-in user owns the hackathon). Returns the object path, or an error.
 */
export async function uploadRewardImage(
  hackathonId: string,
  tierId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 20 * 1024 * 1024) return { error: "Pick an image under 20 MB." };

  let blob: Blob;
  try {
    blob = await squareCrop(file);
  } catch {
    return { error: "Couldn't read that image. Try a PNG, JPEG or SVG." };
  }

  const path = `${hackathonId}/${tierId}/${crypto.randomUUID()}.webp`;
  const { error } = await createClient()
    .storage.from(REWARD_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) return { error: `Upload failed: ${error.message}` };
  return { path };
}

/** Best-effort cleanup of an image that was uploaded but never saved. */
export async function discardRewardImage(path: string) {
  await createClient().storage.from(REWARD_IMAGE_BUCKET).remove([path]);
}
