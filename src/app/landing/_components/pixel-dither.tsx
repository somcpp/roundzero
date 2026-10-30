// A retro dither edge: bands of square pixels thin out step by step, ordered
// by a 4×4 Bayer matrix, so one color dissolves into whatever sits under it.
// Cells are set in pixels, so they stay square at any width.

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** How many of each 16-pixel tile stay filled, band by band. */
const STEPS = [14, 10, 6, 2];

export function PixelDither({
  id,
  color = "#ffffff",
  cell = 6,
  steps = STEPS,
  className = "",
}: {
  /** Prefix for the SVG pattern ids; unique per page. */
  id: string;
  color?: string;
  /** One pixel's size in CSS pixels. */
  cell?: number;
  steps?: number[];
  className?: string;
}) {
  const band = cell * 4;
  return (
    <svg
      aria-hidden
      width="100%"
      height={band * steps.length}
      className={`block ${className}`.trim()}
      shapeRendering="crispEdges"
    >
      <defs>
        {steps.map((filled, i) => (
          <pattern key={i} id={`${id}-${i}`} x="0" y={i * band} width={band} height={band} patternUnits="userSpaceOnUse">
            {BAYER.flatMap((row, y) =>
              row.map((v, x) =>
                v < filled ? <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={color} /> : null,
              ),
            )}
          </pattern>
        ))}
      </defs>
      {steps.map((_, i) => (
        <rect key={i} x="0" y={i * band} width="100%" height={band} fill={`url(#${id}-${i})`} />
      ))}
    </svg>
  );
}
