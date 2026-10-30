import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Docs pages are MDX files in src/content/docs, imported by src/app/docs.
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  experimental: {
    // Pages components/intent-link.tsx prefetches on hover are reused for 30s
    // (the least allowed) rather than the default 5 minutes, so judging data
    // someone else changes doesn't show stale for long.
    staleTimes: { static: 30 },
  },
};

// Turbopack needs remark/rehype plugins by package name, not as functions.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withWorkflow(withMDX(nextConfig));
