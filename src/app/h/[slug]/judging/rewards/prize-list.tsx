"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { Dropdown, Label, ListBox, Select } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { TextInput } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { cn } from "@/components/ui";
import { rewardIcon, type RewardItem, type RewardKind } from "@/lib/data";

const KINDS = Object.keys(rewardIcon) as RewardKind[];

const KIND_LABEL: Record<RewardKind, string> = {
  cash: "Cash",
  credits: "Credits",
  link: "Link",
  code: "Code",
  text: "Text",
  image: "Image",
  file: "File",
  swag: "Swag",
};

// What goes in a prize's second line, by kind. Kinds without one are just a label.
export const DETAIL: Partial<Record<RewardKind, string>> = {
  credits: "Redeem code",
  code: "Code",
  link: "https://…",
  file: "File URL",
  image: "Image URL",
};

/** lib/reward-actions.ts allows this many prizes on a tier. */
const MAX_PRIZES = 30;

const moved = <T,>(xs: T[], from: number, to: number) => {
  const next = [...xs];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
};

/**
 * A tier's prizes as small cards, in the order winner emails list them. Drag
 * a card by its grip to reorder, or focus the grip and use the arrow keys.
 * The thank-you email's bonuses use it too, with their own `noun` and `max`.
 */
export function PrizeList({
  tierName,
  items,
  onChange,
  noun = "prize",
  max = MAX_PRIZES,
  empty,
}: {
  tierName: string;
  items: RewardItem[];
  onChange: (items: RewardItem[]) => void;
  /** What one item is called: "prize", "bonus"… */
  noun?: string;
  max?: number;
  /** Shown while there are none. */
  empty?: ReactNode;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  // Drop position: the card index the dragged one lands before.
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const set = (id: string, patch: Partial<RewardItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const nudge = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    onChange(moved(items, from, to));
    setAnnouncement(`Moved to position ${to + 1} of ${items.length}.`);
  };

  const drop = (e: DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    const from = items.findIndex((x) => x.id === dragId);
    if (from !== -1 && overIdx !== null) {
      const to = overIdx > from ? overIdx - 1 : overIdx;
      if (to !== from) onChange(moved(items, from, to));
    }
    setDragId(null);
    setOverIdx(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty ?? <>No prizes yet. Add what winners of {tierName || "this tier"} get.</>}</p>
      ) : (
        <ol className="flex flex-col gap-2" onDragLeave={() => setOverIdx(null)}>
          {items.map((it, i) => (
            <li
              key={it.id}
              className="relative"
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const box = e.currentTarget.getBoundingClientRect();
                setOverIdx(e.clientY < box.top + box.height / 2 ? i : i + 1);
              }}
              onDrop={drop}
            >
              {overIdx === i && <DropLine className="-top-[5px]" />}
              {overIdx === items.length && i === items.length - 1 && <DropLine className="-bottom-[5px]" />}
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg border-2 border-border bg-surface p-2 pl-1.5 transition",
                  dragId === it.id && "opacity-40",
                )}
              >
                <span
                  role="button"
                  tabIndex={0}
                  draggable
                  aria-label={`Reorder ${it.label || KIND_LABEL[it.kind].toLowerCase()}, position ${i + 1} of ${items.length}`}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  title="Drag, or use the arrow keys, to reorder"
                  onDragStart={(e) => {
                    setDragId(it.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("application/x-prize", it.id);
                    const card = e.currentTarget.closest("li");
                    if (card) e.dataTransfer.setDragImage(card, 16, 22);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverIdx(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    nudge(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                  }}
                  className="grid h-11 w-5 shrink-0 cursor-grab place-items-center rounded-md text-border-tertiary outline-none transition hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
                >
                  <PixelIcon name="grip" size={14} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex gap-2">
                    <KindSelect value={it.kind} onChange={(kind) => set(it.id, { kind })} />
                    <TextInput
                      aria-label={noun.charAt(0).toUpperCase() + noun.slice(1)}
                      value={it.label}
                      maxLength={200}
                      placeholder={it.kind === "cash" ? "$1,000 cash" : "What they get"}
                      className="min-w-0"
                      onChange={(e) => set(it.id, { label: e.target.value })}
                    />
                  </div>
                  {DETAIL[it.kind] && (
                    <TextInput
                      aria-label="Details"
                      value={it.detail}
                      maxLength={2000}
                      placeholder={DETAIL[it.kind]}
                      className="text-sm"
                      onChange={(e) => set(it.id, { detail: e.target.value })}
                    />
                  )}
                </div>
                <ConfirmButton
                  aria-label={`Remove ${it.label || noun}`}
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  title={`Remove this ${noun}?`}
                  description={it.label ? `“${it.label}” comes off the ${tierName || "tier"}.` : undefined}
                  confirmLabel={`Remove ${noun}`}
                  onConfirm={() => onChange(items.filter((x) => x.id !== it.id))}
                  className="mt-1.5 size-8 min-w-0 shrink-0 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <PixelIcon name="trash" size={12} />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Dropdown>
        <Dropdown.Trigger
          isDisabled={items.length >= max}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-secondary px-4 text-sm font-semibold text-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent-soft-foreground data-[pressed]:translate-y-px data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        >
          <PixelIcon name="plus" size={12} />
          {items.length >= max ? (max === MAX_PRIZES ? "Thirty prizes is the most" : `${max} is the most`) : `Add ${noun}`}
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom" className="min-w-48">
          <Dropdown.Menu
            aria-label={`${noun} type`}
            onAction={(key) =>
              onChange([...items, { id: crypto.randomUUID(), kind: key as RewardKind, label: "", detail: "" }])
            }
          >
            {KINDS.map((k) => (
              <Dropdown.Item key={k} id={k} textValue={KIND_LABEL[k]}>
                <PixelIcon name={rewardIcon[k]} size={12} className="text-muted" />
                <Label>{KIND_LABEL[k]}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

/** Where a dragged prize will land, in the gap between two cards. */
function DropLine({ className }: { className: string }) {
  return <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-accent", className)} />;
}

/** A prize's type, with its icon. */
function KindSelect({ value, onChange }: { value: RewardKind; onChange: (kind: RewardKind) => void }) {
  return (
    <Select
      aria-label="Prize type"
      value={value}
      onChange={(key) => key && onChange(key as RewardKind)}
      className="w-[7.5rem] shrink-0"
    >
      <Select.Trigger className="min-h-11 gap-2 rounded-lg border-2 border-border bg-surface px-3 hover:border-border-strong data-[focus-visible]:border-accent">
        <Select.Value>
          <span className="flex items-center gap-2 text-sm">
            <PixelIcon name={rewardIcon[value]} size={12} className="shrink-0 text-accent" />
            {KIND_LABEL[value]}
          </span>
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-44">
        <ListBox>
          {KINDS.map((k) => (
            <ListBox.Item key={k} id={k} textValue={KIND_LABEL[k]}>
              <PixelIcon name={rewardIcon[k]} size={12} className="text-muted" />
              {KIND_LABEL[k]}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
