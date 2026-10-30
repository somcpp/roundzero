import type { BlockType, ProjectRecord, ProjectValue, SchemaBlock } from "@/lib/data";

/** How a block's value is stored in public.project_values. */
export type ValueShape = "string" | "number" | "list";

export function valueShape(type: BlockType): ValueShape {
  if (type === "number") return "number";
  if (type === "image" || type === "file" || type === "team") return "list";
  return "string";
}

export const isLinkType = (type: BlockType) => type === "url" || type === "video url" || type === "repo url";

/** True when a value holds something worth showing. */
export function hasValue(v: ProjectValue | undefined): v is ProjectValue {
  if (v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === "number" || v.trim() !== "";
}

/** A value as one line of text, for search and compact cells. */
export function valueText(v: ProjectValue | undefined) {
  if (!hasValue(v)) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/**
 * The project's name and one-line pitch. The schema has no fixed "name" field,
 * so the first text block is the name and the next text or long text block is
 * the pitch, in form order.
 */
export function projectHeadline(project: Pick<ProjectRecord, "number" | "values">, blocks: SchemaBlock[]) {
  const texts = blocks.filter((b) => b.type === "text" || b.type === "long text");
  const nameBlock = texts.find((b) => b.type === "text");
  const pitchBlock = texts.find((b) => b !== nameBlock);
  const name = valueText(nameBlock && project.values[nameBlock.id]);
  const pitch = valueText(pitchBlock && project.values[pitchBlock.id]);
  return { name: name || `Project ${formatNumber(project.number)}`, pitch, nameBlockId: nameBlock?.id ?? null };
}

const MAX_TEXT = 10000;
const MAX_ITEMS = 50;
const MAX_ITEM = 2000;

const text = (v: unknown) => String(v ?? "").trim();

/** Links typed without a scheme get https:// so they open. */
const withScheme = (url: string) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

/**
 * Check and tidy raw input for a project (block id → what the form or API
 * sent) into what public.project_values stores. Empty values are dropped;
 * unknown block ids are ignored. Shared by the admin drawer, the API and the
 * public submission form, so they all agree on what's valid.
 */
export function normalizeValues(
  blocks: SchemaBlock[],
  raw: Record<string, unknown>,
): { values: Record<string, ProjectValue> } | { error: string } {
  const values: Record<string, ProjectValue> = {};
  for (const b of blocks) {
    const v = raw[b.id];
    if (v === undefined || v === null) continue;
    if (typeof v === "object" && !Array.isArray(v)) return { error: `"${b.title}" should be text, a number or a list.` };
    const shape = valueShape(b.type);
    if (shape === "number") {
      if (typeof v === "string" && v.trim() === "") continue;
      const n = Number(v);
      if (Array.isArray(v) || !Number.isFinite(n)) return { error: `"${b.title}" must be a number.` };
      values[b.id] = n;
    } else if (shape === "list") {
      const items = (Array.isArray(v) ? v : String(v).split("\n")).map(text).filter(Boolean);
      if (!items.length) continue;
      if (items.length > MAX_ITEMS) return { error: `"${b.title}" can have up to ${MAX_ITEMS} entries.` };
      if (items.some((x) => x.length > MAX_ITEM)) return { error: `Keep each entry on "${b.title}" under ${MAX_ITEM} characters.` };
      values[b.id] = b.type === "team" ? items : items.map(withScheme);
    } else {
      if (Array.isArray(v)) return { error: `"${b.title}" takes a single value, not a list.` };
      const s = text(v);
      if (!s) continue;
      if (s.length > MAX_TEXT) return { error: `Keep "${b.title}" under ${MAX_TEXT.toLocaleString()} characters.` };
      if (isLinkType(b.type) && /\s/.test(s)) return { error: `"${b.title}" should be a single link.` };
      values[b.id] = isLinkType(b.type) ? withScheme(s) : s;
    }
  }
  return { values };
}

/** #007-style label. */
export const formatNumber = (n: number) => `#${String(n).padStart(3, "0")}`;
