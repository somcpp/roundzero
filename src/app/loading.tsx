import { PixelLoader } from "@/components/pixel-loader";

/**
 * Shown while a page renders on the server, wherever there's no nearer
 * loading.tsx. Having one also lets <Link> prefetch this far ahead of a click,
 * so navigating to a dynamic page responds straight away.
 */
export default function Loading() {
  return (
    <div className="grid flex-1 place-items-center py-24">
      <PixelLoader />
    </div>
  );
}
