import Image from "next/image";
import { brand } from "@/lib/branding";
import { cn } from "./ui";

/**
 * The org's logo if configured, otherwise its text badge. `className` sizes
 * both; `badgeClassName` styles only the text badge (fill, text, lip), so a
 * logo isn't drawn on a colored tile.
 */
export function BrandMark({ className, badgeClassName }: { className?: string; badgeClassName?: string }) {
  if (brand.logo) {
    return (
      <Image
        src={brand.logo}
        alt={brand.name}
        width={128}
        height={128}
        loading="eager"
        className={cn("rounded-md object-contain", className)}
      />
    );
  }
  return (
    <span className={cn("grid place-items-center rounded-md font-pixel font-bold", className, badgeClassName)}>{brand.badge}</span>
  );
}
