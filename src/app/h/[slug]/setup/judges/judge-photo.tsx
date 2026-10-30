import { Avatar, cn } from "@/components/ui";
import { judgeImageUrl } from "@/lib/judge-images";

/** The judge's uploaded photo, or their pixel identicon until they have one. */
export function JudgePhoto({
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
  const url = judgeImageUrl(imagePath);
  if (!url) return <Avatar name={name || "?"} size={size} className={className} />;
  return (
    // Already downscaled to 512px on upload, so there's nothing for next/image to optimize.
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
