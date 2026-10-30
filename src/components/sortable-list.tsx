"use client";

import { useState, type ReactNode } from "react";
import { Dropdown, Label } from "@heroui/react";
import type { IconName } from "@/lib/data";
import { PixelIcon } from "./pixel-icon";
import { AddTile, cn } from "./ui";

/** `tone` puts the icon on a colored tile (bg + text classes), like the schema's block types. */
export type InsertOption = { id: string; label: string; icon: IconName; tone?: string };

/**
 * An ordered list of cards: drag the grip to reorder, click a card to select
 * it, hover the gap between cards for a + that inserts at that spot.
 *
 * With `insertOptions`, the + opens a menu and `onInsert` gets the picked id;
 * without, the + inserts straight away. `locked` fixes the list: no grip, no
 * inserting or adding, but cards can still be selected.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  selectedId,
  onSelect,
  renderItem,
  onInsert,
  insertOptions,
  addLabel,
  locked = false,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderItem: (item: T, state: { selected: boolean }) => ReactNode;
  onInsert: (at: number, optionId?: string) => void;
  insertOptions?: InsertOption[];
  addLabel: ReactNode;
  locked?: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const drop = (at: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragId) {
      const from = items.findIndex((x) => x.id === dragId);
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(at > from ? at - 1 : at, 0, moved);
      onReorder(next);
    }
    setDragId(null);
    setOverIdx(null);
  };

  const dropTarget = (at: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOverIdx(at);
    },
    onDrop: (e: React.DragEvent) => drop(at, e),
  });

  return (
    <ol className="flex flex-col" onDragLeave={() => setOverIdx(null)}>
      {items.map((item, i) => {
        const selected = selectedId === item.id;
        return (
          <li key={item.id} {...(locked ? {} : dropTarget(i))}>
            {locked ? (
              <div className="h-3" />
            ) : (
              <InsertGap
                highlight={overIdx === i}
                options={insertOptions}
                onInsert={(optionId) => onInsert(i, optionId)}
              />
            )}
            <div
              className={cn(
                "group/item flex items-center gap-3 rounded-xl border-2 bg-surface pl-2 shadow-block transition sm:gap-4 sm:pl-5",
                selected ? "border-accent ring-4 ring-accent-soft" : "border-border hover:border-border-secondary",
                dragId === item.id && "opacity-40",
              )}
            >
              {!locked && (
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragId(item.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragId(null)}
                  className="hidden cursor-grab text-border-tertiary hover:text-foreground active:cursor-grabbing sm:inline"
                  aria-label="Drag to reorder"
                >
                  <PixelIcon name="grip" size={16} />
                </span>
              )}
              {/* Phones can't drag (no HTML5 drag and drop on touch), so they get move buttons instead. */}
              {!locked && (
                <span className="flex flex-col sm:hidden">
                  {([-1, 1] as const).map((step) => (
                    <button
                      key={step}
                      type="button"
                      aria-label={`Move item ${i + 1} ${step < 0 ? "up" : "down"}`}
                      disabled={step < 0 ? i === 0 : i === items.length - 1}
                      onClick={() => {
                        const next = [...items];
                        [next[i], next[i + step]] = [next[i + step], next[i]];
                        onReorder(next);
                      }}
                      className="grid size-8 place-items-center rounded-md text-muted active:bg-surface-secondary disabled:opacity-25"
                    >
                      <PixelIcon name={step < 0 ? "arrow-up" : "arrow-down"} size={10} />
                    </button>
                  ))}
                </span>
              )}
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 py-4 pr-5 text-left"
              >
                {renderItem(item, { selected })}
              </button>
            </div>
          </li>
        );
      })}
      {!locked && (
        <li className="pt-3" {...dropTarget(items.length)}>
          <AddTile
            onClick={() => onInsert(items.length, insertOptions?.[0]?.id)}
            className={cn(overIdx === items.length && "border-accent bg-accent-soft")}
          >
            {addLabel}
          </AddTile>
        </li>
      )}
    </ol>
  );
}

/** The space above a card; hovering it reveals a + that inserts there. */
function InsertGap({
  highlight,
  options,
  onInsert,
}: {
  highlight: boolean;
  options?: InsertOption[];
  onInsert: (optionId?: string) => void;
}) {
  const triggerClass =
    "absolute top-1/2 left-1/2 z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-md border-2 border-accent bg-surface text-accent opacity-0 transition group-hover/gap:opacity-100 focus-visible:opacity-100 data-[pressed]:opacity-100";

  return (
    <div className="group/gap relative h-3">
      <span
        className={cn(
          "absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition",
          highlight ? "bg-accent" : "bg-transparent group-hover/gap:bg-accent-soft-hover",
        )}
      />
      {options ? (
        <Dropdown>
          <Dropdown.Trigger aria-label="Insert here" className={triggerClass}>
            <PixelIcon name="plus" size={10} />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom" className="min-w-44">
            <Dropdown.Menu aria-label="Insert" onAction={(key) => onInsert(String(key))}>
              {options.map((o) => (
                <Dropdown.Item key={o.id} id={o.id} textValue={o.label}>
                  {o.tone ? (
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", o.tone)}>
                      <PixelIcon name={o.icon} size={10} />
                    </span>
                  ) : (
                    <PixelIcon name={o.icon} size={12} className="text-muted" />
                  )}
                  <Label>{o.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      ) : (
        <button type="button" aria-label="Insert here" onClick={() => onInsert()} className={triggerClass}>
          <PixelIcon name="plus" size={10} />
        </button>
      )}
    </div>
  );
}
