import { PixelLoader } from "@/components/pixel-loader";

/**
 * A hackathon page loading: the nav stays put and this fills the page below it.
 * A loading state only shows when the segment right below it changes, so the
 * tab levels under here (setup/, judging/, …) re-export this one too.
 */
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col">
      <div className="mb-8 flex flex-col gap-3">
        <span className="h-3 w-20 animate-pulse rounded bg-surface-secondary" />
        <span className="h-9 w-72 max-w-full animate-pulse rounded-md bg-surface-secondary" />
      </div>
      <div className="grid min-h-80 place-items-center rounded-2xl border-2 border-border">
        <PixelLoader />
      </div>
    </div>
  );
}
