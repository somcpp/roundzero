import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { DEMO_MODE } from "@/lib/demo";

/** The page's one primary action: organizers sign in and start running hackathons. */
export function GetStarted({ small = false, className = "" }: { small?: boolean; className?: string }) {
  const classes = `btn-arcade ${small ? "btn-arcade--sm" : ""} ${className}`.trim();
  return (
    <Link href="/login" className={classes}>
      Get started
      <PixelIcon name="arrow-right" size={small ? 11 : 13} />
    </Link>
  );
}

/**
 * The live demo: with DEMO_MODE on, /login comes filled in with the shared demo login (lib/demo.ts), so it's one
 * click to look around. Renders nothing otherwise.
 */
export function TryDemo({ small = false, className = "" }: { small?: boolean; className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <Link href="/login" className={`btn-arcade btn-arcade--light ${small ? "btn-arcade--sm" : ""} ${className}`.trim()}>
      Try the demo
    </Link>
  );
}
