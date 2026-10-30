import { createClient } from "@/lib/supabase/client";

// Hackathon banners live in the public hackathon-banners bucket at
// <hackathon_id>/<random>.webp (see migrations/*_hackathon_banners.sql). A
// banner replaces the pixel-art cover on the hackathon's card and public pages.
export const HACKATHON_BANNER_BUCKET = "hackathon-banners";

// Covers run from about 2:1 (home cards) to 5:1 (winners page), so banners are
// center-cropped to 8:3, in between, and stored at most 1600×600.
const WIDTH = 1600;
const HEIGHT = 600;

export function hackathonBannerUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${HACKATHON_BANNER_BUCKET}/${path}`;
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

/** Center-crop to 8:3, scale to 1600px wide (up for SVGs, never up for bitmaps), keep transparency, and re-encode as WebP. */
async function wideCrop(file: File): Promise<Blob> {
  const img = await loadImage(file);
  // SVGs without intrinsic dimensions report 0; render them at full size.
  const w = img.naturalWidth || WIDTH;
  const h = img.naturalHeight || HEIGHT;
  // The largest 8:3 box that fits, centered.
  const cropW = Math.min(w, (h * WIDTH) / HEIGHT);
  const cropH = (cropW * HEIGHT) / WIDTH;
  const scale = file.type === "image/svg+xml" ? WIDTH / cropW : Math.min(1, WIDTH / cropW);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropW * scale));
  canvas.height = Math.max(1, Math.round(cropH * scale));
  canvas.getContext("2d")!.drawImage(img, (w - cropW) / 2, (h - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/webp", 0.85),
  );
}

/**
 * Upload a banner straight from the browser (the storage policies check the
 * signed-in user owns the hackathon). Returns the object path, or an error.
 */
export async function uploadHackathonBanner(hackathonId: string, file: File): Promise<{ path: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 20 * 1024 * 1024) return { error: "Pick an image under 20 MB." };

  let blob: Blob;
  try {
    blob = await wideCrop(file);
  } catch {
    return { error: "Couldn't read that image. Try a PNG, JPEG or SVG." };
  }

  const path = `${hackathonId}/${crypto.randomUUID()}.webp`;
  const { error } = await createClient()
    .storage.from(HACKATHON_BANNER_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) return { error: `Upload failed: ${error.message}` };
  return { path };
}

/** Best-effort cleanup of a banner that was uploaded but never saved. */
export async function discardHackathonBanner(path: string) {
  await createClient().storage.from(HACKATHON_BANNER_BUCKET).remove([path]);
}
