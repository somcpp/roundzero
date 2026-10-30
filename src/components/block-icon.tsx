import { blockTypes, type BlockType } from "@/lib/data";
import { PixelIcon } from "./pixel-icon";
import { cn } from "./ui";

/** Each block type gets its own candy color, so a schema reads at a glance. */
export const BLOCK_TONES: Record<BlockType, string> = {
  text: "bg-sky-500 text-white",
  "long text": "bg-indigo-500 text-white",
  number: "bg-amber-500 text-white",
  url: "bg-teal-500 text-white",
  "video url": "bg-rose-500 text-white",
  "repo url": "bg-violet-500 text-white",
  file: "bg-orange-500 text-white",
  select: "bg-lime-600 text-white",
  image: "bg-pink-500 text-white",
  team: "bg-emerald-500 text-white",
};

const SIZES = {
  sm: { box: "size-6 rounded-md", icon: 10 },
  md: { box: "size-9 rounded-lg", icon: 14 },
} as const;

/** A block type's icon on a solid colored tile with a pressable bottom lip, like a game key. */
export function BlockIcon({
  type,
  size = "md",
  className,
}: {
  type: BlockType;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const info = blockTypes.find((t) => t.type === type) ?? blockTypes[0];
  return (
    <span
      aria-hidden
      className={cn(
        "lip grid shrink-0 place-items-center",
        SIZES[size].box,
        BLOCK_TONES[type],
        className,
      )}
    >
      <PixelIcon name={info.icon} size={SIZES[size].icon} />
    </span>
  );
}
