import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectValue, SchemaBlock } from "@/lib/data";
import { embedTexts, web } from "@/lib/ai";
import { formatNumber, hasValue, isLinkType, projectHeadline, valueText } from "@/lib/project-fields";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

// The RAG side of project ingestion: every saved project is written out as
// text, split into chunks, embedded and stored in public.project_chunks
// (supabase/migrations/*_create_project_rag_and_chat.sql). Pages the project
// links to (repo, demo) are fetched with Tavily and indexed alongside.
//
// Every way a project's fields change re-indexes it: saveProject (admin
// add/edit), intake (API and submission form) and sample data. Phase and
// status aren't embedded, so judging moves never make the index stale; the
// chat reads those from the database.

const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 200;
/** Links fetched per project, and how much of each page is kept. */
const MAX_PAGES = 3;
const MAX_PAGE_CHARS = 12000;
const MAX_CHUNKS = 40;

type Chunk = { source: "submission" | "web"; source_url: string | null; content: string };

/** Split text on paragraph, then line, then sentence boundaries into ~CHUNK_SIZE pieces with a little overlap. */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (cut > size * 0.5) end = start + cut + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

/** The project as one plain-text document: headline, then every filled-in field. */
export function projectDocument(project: { number: number; values: Record<string, ProjectValue> }, blocks: SchemaBlock[]) {
  const { name, pitch, nameBlockId } = projectHeadline(project, blocks);
  const lines = [`Project ${formatNumber(project.number)}: ${name}`];
  if (pitch) lines.push(pitch);
  lines.push("");
  for (const b of blocks) {
    const v = project.values[b.id];
    if (b.id === nameBlockId || !hasValue(v)) continue;
    lines.push(`${b.title}: ${valueText(v)}`);
  }
  return { name, text: lines.join("\n") };
}

async function fetchPages(urls: string[]): Promise<{ url: string; title: string | null; content: string }[]> {
  if (urls.length === 0 || !process.env.TAVILY) return [];
  try {
    const res = await web.extract(urls, { format: "markdown", extractDepth: "basic", timeout: 20 });
    return res.results
      .filter((r) => r.rawContent?.trim())
      .map((r) => ({ url: r.url, title: r.title, content: r.rawContent.slice(0, MAX_PAGE_CHARS) }));
  } catch (e) {
    console.warn("[project-index] Tavily extract failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

export type IndexResult = { chunks: number; pages: number };

export type IndexOptions = {
  /** false skips Tavily (sample data links go nowhere). */
  fetchLinks?: boolean;
  blocks?: SchemaBlock[];
  /**
   * Defaults to the signed-in owner's client, so RLS scopes every read and
   * write. The intake route passes the admin client, since its callers are
   * anonymous; it must also pass `blocks`.
   */
  supabase?: SupabaseClient;
};

/** Rebuild one project's chunks. */
export async function indexProject(
  hackathonId: string,
  projectId: string,
  { fetchLinks = true, blocks, supabase: client }: IndexOptions = {},
): Promise<IndexResult> {
  const supabase = client ?? (await createClient());
  const { data: row, error } = await supabase
    .from("projects")
    .select("number, project_values(block_id, value)")
    .eq("id", projectId)
    .eq("hackathon_id", hackathonId)
    .maybeSingle<{ number: number; project_values: { block_id: string; value: ProjectValue }[] }>();
  if (error) throw new Error(`Couldn't load the project to index: ${error.message}`);
  if (!row) throw new Error("Project not found.");

  const schema = blocks ?? (await listSchemaBlocks(hackathonId));
  const values = Object.fromEntries(row.project_values.map((v) => [v.block_id, v.value]));
  const doc = projectDocument({ number: row.number, values }, schema);
  const header = `Project ${formatNumber(row.number)}: ${doc.name}`;

  const chunks: Chunk[] = chunkText(doc.text).map((content) => ({ source: "submission", source_url: null, content }));

  if (fetchLinks) {
    const urls = schema
      .filter((b) => isLinkType(b.type) && typeof values[b.id] === "string")
      .map((b) => values[b.id] as string)
      .slice(0, MAX_PAGES);
    for (const page of await fetchPages(urls)) {
      // Prefix each chunk so a match on its own still says which project it's from.
      const prefix = `${header} — linked page ${page.title ? `"${page.title}" ` : ""}(${page.url})\n\n`;
      for (const piece of chunkText(page.content)) {
        chunks.push({ source: "web", source_url: page.url, content: prefix + piece });
      }
    }
  }

  const kept = chunks.slice(0, MAX_CHUNKS).map((c) => ({ ...c, content: c.content.slice(0, 8000) }));
  const embeddings = await embedTexts(kept.map((c) => c.content));
  const { error: saveError } = await supabase.rpc("replace_project_chunks", {
    p_project_id: projectId,
    p_chunks: kept.map((c, i) => ({ ...c, embedding: embeddings[i] })),
  });
  if (saveError) throw new Error(`Couldn't save the project index: ${saveError.message}`);
  return { chunks: kept.length, pages: new Set(kept.filter((c) => c.source === "web").map((c) => c.source_url)).size };
}

/** Index a project and log instead of throwing: for after(), where nobody is waiting on the result. */
export async function indexProjectQuietly(...args: Parameters<typeof indexProject>) {
  try {
    await indexProject(...args);
  } catch (e) {
    console.error("[project-index]", e instanceof Error ? e.message : e);
  }
}

/** Index several projects, four at a time so Tavily and Nebius aren't flooded. Never throws. */
export async function indexProjects(hackathonId: string, ids: string[], options: IndexOptions = {}) {
  let indexed = 0;
  let failed = 0;
  const queue = [...ids];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          await indexProject(hackathonId, id, options);
          indexed++;
        } catch (e) {
          failed++;
          console.error("[project-index]", id, e instanceof Error ? e.message : e);
        }
      }
    }),
  );
  return { indexed, failed };
}

export type IndexStatus = { total: number; indexed: number; stale: string[] };

/**
 * Which projects are missing from the index or whose fields changed after it
 * was built. "Changed" comes from the audit trail's submitted/edited entries,
 * not projects.updated_at, which judging moves and ranks bump too. Reads only
 * chunk 0 per project.
 */
export async function getIndexStatus(hackathonId: string): Promise<IndexStatus> {
  const supabase = await createClient();
  const [projects, chunks, events] = await Promise.all([
    supabase.from("projects").select("id").eq("hackathon_id", hackathonId),
    supabase.from("project_chunks").select("project_id, created_at").eq("hackathon_id", hackathonId).eq("chunk_index", 0),
    supabase
      .from("project_events")
      .select("project_id, created_at, projects!inner(hackathon_id)")
      .eq("projects.hackathon_id", hackathonId)
      .in("kind", ["submitted", "edited"]),
  ]);
  if (projects.error || chunks.error || events.error) {
    throw new Error(`Couldn't read the project index: ${(projects.error ?? chunks.error ?? events.error)!.message}`);
  }
  const builtAt = new Map(chunks.data.map((c) => [c.project_id as string, new Date(c.created_at as string)]));
  const changedAt = new Map<string, Date>();
  for (const e of events.data) {
    const at = new Date(e.created_at as string);
    const prev = changedAt.get(e.project_id as string);
    if (!prev || prev < at) changedAt.set(e.project_id as string, at);
  }
  const stale = projects.data
    .filter((p) => {
      const built = builtAt.get(p.id as string);
      const changed = changedAt.get(p.id as string);
      return !built || (changed !== undefined && built < changed);
    })
    .map((p) => p.id as string);
  return { total: projects.data.length, indexed: projects.data.length - stale.length, stale };
}
