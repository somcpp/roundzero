import type { Metadata } from "next";
import { brand } from "@/lib/branding";
import { MotionRoot } from "./_components/motion-root";
import "./landing.css";

// Only reachable on the RoundZero site hosts (lib/site.ts): the proxy rewrites
// "/" here for signed-out visitors. The .landing wrapper scopes landing.css.

const title = `${brand.name} · AI-assisted hackathon judging and management`;
const description = `Hackathon judging and management. The ${brand.name} agent, built on NVIDIA Nemotron and Nebius, checks every project so your judges can score the ideas.`;

// Setting openGraph/twitter here replaces the root layout's, share image
// included, so point back at the root opengraph-image.png / twitter-image.png.
const image = { width: 1200, height: 630, alt: `${brand.name}: hackathon judging agent and management` };

export const metadata: Metadata = {
  title,
  description,
  openGraph: { type: "website", siteName: brand.name, url: "/", title, description, images: { url: "/opengraph-image.png", ...image } },
  twitter: { card: "summary_large_image", title, description, images: { url: "/twitter-image.png", ...image } },
};

export default function LandingLayout({ children }: LayoutProps<"/landing">) {
  return (
    <div className="landing flex-1">
      <MotionRoot>{children}</MotionRoot>
    </div>
  );
}
