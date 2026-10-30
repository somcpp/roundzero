import { PixelIcon } from "@/components/pixel-icon";
import { cn } from "@/components/ui";
import { rewardImageUrl } from "@/lib/reward-images";

/** A tier's square prize image, or a gift tile until it has one. */
export function RewardImage({
  name,
  imagePath,
  size = 40,
  className,
}: {
  name: string;
  imagePath: string | null;
  size?: number;
  className?: string;
}) {
  const url = rewardImageUrl(imagePath);
  if (!url) {
    return (
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-foreground", className)}
        style={{ width: size, height: size }}
      >
        <PixelIcon name="gift" size={Math.max(12, Math.round(size / 3))} />
      </span>
    );
  }
  return (
    // Already cropped and downscaled to 512px on upload, so there's nothing for next/image to optimize.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md bg-surface-secondary object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
