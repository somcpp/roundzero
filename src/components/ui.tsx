import Link from "next/link";
import { buttonVariants } from "@heroui/styles";
import type { ComponentProps, ReactNode } from "react";
import type { IconName } from "@/lib/data";
import { PixelIcon } from "./pixel-icon";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ── Type ──────────────────────────────────────────────────────────────────

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "font-pixel text-xs uppercase tracking-[0.08em] text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  hint,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="text-3xl leading-none sm:text-4xl">{title}</h1>
        {hint && <p className="text-muted">{hint}</p>}
      </div>
      {/* Wraps on narrow screens rather than pushing the page wider than the viewport. */}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-xl leading-none">{children}</h2>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

// ── Surfaces ──────────────────────────────────────────────────────────────

export function Panel({
  className,
  children,
  ...rest
}: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl border-2 border-border bg-surface shadow-block", className)} {...rest}>
      {children}
    </div>
  );
}

export function Placeholder({
  label,
  className,
  icon,
}: {
  label?: ReactNode;
  className?: string;
  icon?: IconName;
}) {
  return (
    <div
      className={cn(
        "dither grid place-items-center rounded-lg border-2 border-border text-sm text-muted",
        className,
      )}
    >
      <span className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1">
        {icon && <PixelIcon name={icon} size={12} />}
        {label}
      </span>
    </div>
  );
}

export function AddTile({
  children,
  className,
  ...rest
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-secondary px-4 py-3 text-[15px] font-semibold text-muted transition enabled:hover:border-accent enabled:hover:bg-accent-soft enabled:hover:text-accent-soft-foreground enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <PixelIcon name="plus" size={14} />
      {children}
    </button>
  );
}

// ── Chips & badges ────────────────────────────────────────────────────────

export function Chip({
  children,
  active,
  icon,
  className,
  ...rest
}: ComponentProps<"span"> & { active?: boolean; icon?: IconName }) {
  const classes = cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-b-[3.5px] px-3 py-1 text-sm font-semibold transition",
    active
      ? "border-[color-mix(in_oklab,var(--accent)_72%,black)] bg-accent text-accent-foreground"
      : "border-border bg-surface text-foreground",
    rest.onClick && "cursor-pointer select-none hover:-translate-y-px active:translate-y-0.5",
    className,
  );
  const content = (
    <>
      {icon && <PixelIcon name={icon} size={12} />}
      {children}
    </>
  );
  // A clickable chip is a toggle, so it's a button: focusable, and keyboards and screen readers can use it.
  if (rest.onClick) {
    return (
      <button type="button" aria-pressed={!!active} className={classes} {...(rest as ComponentProps<"button">)}>
        {content}
      </button>
    );
  }
  return (
    <span className={classes} {...rest}>
      {content}
    </span>
  );
}

const TONES = {
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
  neutral: "bg-surface-secondary text-muted",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
  /** Shown on hover, e.g. the detail behind a short label. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs leading-none font-medium shadow-[inset_0_-2px_0_0_color-mix(in_oklab,currentColor_18%,transparent)]",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-2 bg-current" />}
      {children}
    </span>
  );
}

// ── Identity ──────────────────────────────────────────────────────────────

const AVATAR_HUES = [285, 250, 200, 160, 130, 60, 30, 10, 330];

/** 5×5 mirrored identicon — every judge gets a little sprite. */
export function Avatar({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const h = hash(name);
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  const cells: [number, number][] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((h >> (y * 3 + x)) & 1) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 7 7"
      className={cn("pixelated shrink-0 rounded-md", className)}
      style={{ background: `oklch(0.95 0.04 ${hue})` }}
      role="img"
      aria-label={name}
    >
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={`oklch(0.55 0.16 ${hue})`} />
      ))}
    </svg>
  );
}

function coverCells(seed: string) {
  const W = 24;
  const H = 12;
  let h = hash(seed);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const cells: { x: number; y: number; o: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W / 2; x++) {
      // Denser toward the bottom — reads like a skyline / landscape.
      const p = 0.08 + (y / H) * 0.55;
      if (rand() < p) {
        const o = 0.25 + rand() * 0.75;
        cells.push({ x, y, o }, { x: W - 1 - x, y, o });
      }
    }
  }
  return { W, H, cells };
}

/**
 * Deterministic pixel-art cover for a hackathon, tinted with its brand color.
 * An uploaded banner `image` fills the box instead of the pixel art.
 */
export function PixelCover({
  seed,
  color,
  neutral,
  image,
  className,
  children,
}: {
  seed: string;
  /** The brand color the pixels are tinted with. Not needed when `neutral`. */
  color?: string;
  /** Quiet grays on the surface color instead of the brand tint, for when what sits on top brings its own colors. */
  neutral?: boolean;
  image?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const { W, H, cells } = coverCells(seed);
  return (
    <div
      className={cn("relative overflow-hidden", neutral && "bg-surface", className)}
      style={neutral ? undefined : { background: `color-mix(in oklab, ${color} 8%, white)` }}
    >
      {image ? (
        // Already cropped and downscaled on upload, so there's nothing for next/image to optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="pixelated absolute inset-0 size-full"
          aria-hidden
        >
          {cells.map((c, i) => (
            <rect key={i} x={c.x} y={c.y} width={1} height={1} fill={neutral ? "var(--border-strong)" : color} opacity={c.o * 0.55} />
          ))}
        </svg>
      )}
      {children && <div className="relative">{children}</div>}
    </div>
  );
}

export function LogoMark({
  text,
  color,
  src,
  size = 32,
  className,
}: {
  text: string;
  color: string;
  /** Uploaded logo image; the initials on `color` show until there is one. */
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      // Already downscaled to 512px on upload, so there's nothing for next/image to optimize.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-md object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn("lip grid shrink-0 place-items-center rounded-md font-pixel text-white", className)}
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {text}
    </span>
  );
}

// ── Numbers ───────────────────────────────────────────────────────────────

/** Segmented bar, like an HP/XP meter. */
export function Segments({
  value,
  max = 100,
  count = 20,
  className,
  tone = "accent",
}: {
  value: number;
  max?: number;
  count?: number;
  className?: string;
  tone?: "accent" | "success" | "muted";
}) {
  const lit = Math.round((value / max) * count);
  const on = tone === "success" ? "bg-success" : tone === "muted" ? "bg-foreground/40" : "bg-accent";
  return (
    <div className={cn("flex h-2.5 gap-[3px]", className)} role="meter" aria-valuenow={value} aria-valuemax={max}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cn("flex-1 rounded-[2px]", i < lit ? on : "bg-surface-tertiary")} />
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="font-pixel text-3xl leading-none">{value}</div>
      {hint && <div className="text-sm text-muted">{hint}</div>}
    </div>
  );
}

// ── Actions ───────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "danger-soft";

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {children}
    </Link>
  );
}

export function TextLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn("underline decoration-border-secondary underline-offset-4 hover:decoration-accent", className)}
      {...rest}
    />
  );
}

// ── Explainers ────────────────────────────────────────────────────────────

/** One icon + title + text row in a page's "How it's used" sidebar. */
export function ExplainerItem({ icon, title, children }: { icon: IconName; title: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-secondary text-muted">
        <PixelIcon name={icon} size={12} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted">{children}</span>
      </span>
    </li>
  );
}
