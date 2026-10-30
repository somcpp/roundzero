import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { DEMO_MODE } from "@/lib/demo";
import { GithubLogo } from "./brand-logos";
import { GITHUB_REPO } from "./links";

/** The page's one primary action: the repo on GitHub, or the deployment guide until the repo is public. */
export function GetStarted({ small = false, className = "" }: { small?: boolean; className?: string }) {
  const classes = `btn-arcade ${small ? "btn-arcade--sm" : ""} ${className}`.trim();
  if (!GITHUB_REPO) {
    return (
      <Link href="/docs/reference/deployment" className={classes}>
        Get started
        <PixelIcon name="arrow-right" size={small ? 11 : 13} />
      </Link>
    );
  }
  return (
    <a href={GITHUB_REPO} target="_blank" rel="noreferrer" className={classes}>
      <GithubLogo className={small ? "size-3.5" : "size-4"} />
      Get started
    </a>
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
