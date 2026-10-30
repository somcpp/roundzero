"use client";

import { useState } from "react";
import { PixelIcon } from "@/components/pixel-icon";

/**
 * A dashed "+ New" chip that turns into a small input; Enter adds the option.
 * With `repeat`, the input stays open after Enter for the next one.
 */
export function NewOptionChip({
  label,
  onAdd,
  repeat,
}: {
  label: string;
  onAdd: (label: string) => void;
  repeat?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const commit = (keepOpen = false) => {
    const v = value.trim();
    if (v) onAdd(v.slice(0, 80));
    setValue("");
    setEditing(keepOpen && !!v);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-border-secondary px-3 py-1 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent-soft-foreground"
      >
        <PixelIcon name="plus" size={10} />
        {label}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={80}
      placeholder={label}
      aria-label={label}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(repeat);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setValue("");
          setEditing(false);
        }
      }}
      className="h-[34px] w-40 rounded-full border-2 border-accent bg-surface px-3 text-sm outline-none ring-4 ring-accent-soft"
    />
  );
}
