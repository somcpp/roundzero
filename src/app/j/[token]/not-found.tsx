import { PixelIcon } from "@/components/pixel-icon";

/** A judge link whose token doesn't open anything: wrong, or replaced with a new one. */
export default function JudgeLinkNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-xl bg-surface-secondary text-muted">
        <PixelIcon name="lock" size={24} />
      </span>
      <h1 className="text-3xl">This judging link doesn&apos;t work</h1>
      <p className="max-w-md text-muted">
        Check you copied the whole link. If you did, it may have been replaced with a new one, so ask the organizers for
        your current link.
      </p>
    </main>
  );
}
