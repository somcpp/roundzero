"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { PixelIcon } from "./pixel-icon";
import { cn } from "./ui";

export const inputClass =
  "min-h-11 w-full rounded-lg border-2 border-border bg-surface px-3.5 py-2.5 text-[15px] shadow-[inset_0_2px_0_0_oklch(0_0_0/0.03)] outline-none transition placeholder:text-field-placeholder hover:border-border-strong focus:border-accent focus:ring-4 focus:ring-accent-soft";

/** A form field's label in plain words; pixel caps (Eyebrow) are for section headings. */
export const fieldLabelClass = "text-base font-medium text-foreground";

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(fieldLabelClass, className)}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <FieldLabel>{label}</FieldLabel>
        {hint && <span className="text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(inputClass, "resize-none", props.className)} />;
}

/**
 * Short values as removable chips, e.g. package names. Enter (or leaving the
 * field) adds what's typed; pasting several lines adds one per line; Backspace
 * in an empty field removes the last.
 */
export function TagInput({
  values,
  onChange,
  placeholder,
  max = 30,
  maxLength = 200,
  label,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  label: string;
}) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const fresh = raw
      .split("\n")
      .map((s) => s.trim().slice(0, maxLength))
      .filter((s, i, all) => s && !values.includes(s) && all.indexOf(s) === i);
    if (fresh.length) onChange([...values, ...fresh].slice(0, max));
    setDraft("");
  };

  return (
    <div
      className={cn(inputClass, "flex h-auto cursor-text flex-wrap items-center gap-1.5 py-2")}
      onClick={() => input.current?.focus()}
    >
      {values.map((v) => (
        <span key={v} className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-surface-secondary px-2 py-1 font-mono text-xs">
          <span className="truncate">{v}</span>
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="shrink-0 text-muted transition hover:text-danger"
          >
            <PixelIcon name="x" size={8} />
          </button>
        </span>
      ))}
      {values.length < max && (
        <input
          ref={input}
          value={draft}
          aria-label={label}
          maxLength={maxLength}
          placeholder={values.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!text.includes("\n")) return;
            e.preventDefault();
            add(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          className="min-w-32 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-field-placeholder"
        />
      )}
    </div>
  );
}

export function Select({
  options,
  className,
  ...rest
}: ComponentProps<"select"> & { options: string[] }) {
  return (
    <div className="relative">
      <select {...rest} className={cn(inputClass, "appearance-none pr-10", className)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <PixelIcon name="arrow-down" size={12} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
  /** For a switch that saves as soon as it flips, e.g. off in a demo (components/read-only.tsx). */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("flex items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60", className)}
    >
      <span
        className={cn(
          "relative flex h-7 w-12 shrink-0 items-center rounded-lg border-2 p-[3px] transition",
          checked ? "border-accent bg-accent" : "border-border-strong bg-surface-secondary",
        )}
      >
        <span
          className={cn(
            "size-[1.125rem] rounded-md bg-white shadow-[0_2px_0_0_oklch(0_0_0/0.15)] transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5 pt-0.5">
          {label && <span className="text-[15px] font-medium">{label}</span>}
          {description && <span className="text-sm text-muted">{description}</span>}
        </span>
      )}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex gap-0.5 rounded-xl border-2 border-border bg-surface p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-semibold transition whitespace-nowrap",
            size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-3.5 text-[15px]",
            value === o.value ? "lip bg-foreground text-background" : "text-muted hover:bg-surface-secondary hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="inline-flex items-center rounded-lg border-2 border-border bg-surface">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(clamp(value - step))}
        className="grid size-10 place-items-center text-muted hover:text-foreground disabled:opacity-30"
        disabled={value <= min}
      >
        <span className="block h-[2px] w-2.5 bg-current" />
      </button>
      <span className="min-w-12 text-center font-pixel text-base tabular-nums">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(clamp(value + step))}
        className="grid size-10 place-items-center text-muted hover:text-foreground disabled:opacity-30"
        disabled={value >= max}
      >
        <PixelIcon name="plus" size={12} />
      </button>
    </div>
  );
}

/**
 * Pixel rating: a row of blocks you click, like filling an HP bar.
 * Faster and more legible for judges than a drag slider.
 */
export function BlockRating({
  value,
  onChange,
  max = 10,
  ghost,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  max?: number;
  ghost?: number | null;
  label?: string;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const lit = value !== null && n <= value;
        const isGhost = ghost != null && n === Math.round(ghost);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            title={`${n}`}
            onClick={() => onChange(n)}
            className={cn(
              "relative h-8 flex-1 rounded-[5px] transition active:translate-y-px",
              lit ? "lip bg-accent hover:bg-accent-hover" : "bg-surface-tertiary hover:bg-accent-soft-hover",
            )}
          >
            {isGhost && (
              <span className="absolute inset-x-0 -bottom-2 mx-auto size-1.5 bg-foreground" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
