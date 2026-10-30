"use client";

import { ListBox, Select } from "@heroui/react";
import { PixelIcon } from "./pixel-icon";
import { cn } from "./ui";

/** Search box for a list page's filter bar. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("relative flex min-w-56 flex-1 items-center sm:max-w-72", className)}>
      <PixelIcon name="search" size={12} className="pointer-events-none absolute left-3 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        className="h-10 w-full rounded-lg border-2 border-border bg-surface pr-3 pl-8 text-sm outline-none transition hover:border-border-strong focus:border-accent focus:ring-4 focus:ring-accent-soft"
      />
    </label>
  );
}

/** Stands in for the "" option (any / none), since a list item needs a real key. */
const ANY = "__any__";

/** Compact select for a filter bar; highlighted while it's filtering. */
export function ToolbarSelect({
  label,
  value,
  active,
  options,
  onChange,
}: {
  label: string;
  value: string;
  active: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const key = (v: string) => v || ANY;
  return (
    <Select
      aria-label={label}
      value={key(value)}
      onChange={(k) => k !== null && onChange(k === ANY ? "" : String(k))}
    >
      <Select.Trigger
        className={cn(
          "h-10 min-h-10 gap-2 pl-3 text-sm font-semibold",
          active && "border-accent bg-accent-soft text-accent-soft-foreground",
        )}
      >
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-52">
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={key(o.value)} id={key(o.value)} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
