import { cn } from "./ui";

// The order the 3×3 grid lights up in: round the edge, clockwise. The centre stays dim.
// Negative delays start every square mid-cycle, so none sits lit waiting its turn.
const ORDER = [0, 1, 2, 5, 8, 7, 6, 3];

/**
 * A 3×3 pixel grid with a lit square running round its edge, for pages that
 * are loading. It fades in after a beat, so quick loads don't flash it.
 */
export function PixelLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("pixel-loader grid size-7 grid-cols-3 gap-0.5", className)}>
      {Array.from({ length: 9 }, (_, i) => {
        const step = ORDER.indexOf(i);
        return (
          <span
            key={i}
            className={cn("rounded-[1px] bg-accent", step === -1 ? "opacity-15" : "pixel-loader__dot")}
            style={step === -1 ? undefined : { animationDelay: `${(step - ORDER.length) * 100}ms` }}
          />
        );
      })}
    </span>
  );
}
