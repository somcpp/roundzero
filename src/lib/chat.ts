import type { UIMessage } from "ai";
import type { ProjectRecord, ProjectStatus } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Reads for the judging chat's saved threads
// (supabase/migrations/*_create_project_rag_and_chat.sql). RLS limits them to
// the admin who started them.

/** Which projects a chat talks about. An empty list means no filter on that axis; within one, any match counts. */
export type ChatScope = {
  phaseIds: string[];
  statuses: ProjectStatus[];
  /** Projects assigned to any of these judges, in any phase. */
  judgeIds: string[];
  /** Hand-picked projects; when set, only these are in scope. */
  projectIds: string[];
};

export const EMPTY_SCOPE: ChatScope = { phaseIds: [], statuses: [], judgeIds: [], projectIds: [] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set<string>(["active", "eliminated", "disqualified"]);

/** Distinct valid values from a list, or from a legacy single value. */
function list(raw: unknown, valid: (v: string) => boolean, max: number) {
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return [...new Set(values.filter((v): v is string => typeof v === "string" && valid(v)))].slice(0, max);
}

const isUuid = (v: string) => UUID.test(v);

/**
 * A scope from untrusted JSON, with anything malformed dropped. Threads saved
 * before multi-select hold single phaseId/status/judgeId values. The caps keep
 * it under chat_threads.scope's 4000-byte check.
 */
export function parseScope(raw: unknown): ChatScope {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    phaseIds: list(o.phaseIds ?? o.phaseId, isUuid, 10),
    statuses: list(o.statuses ?? o.status, (v) => STATUSES.has(v), 3) as ProjectStatus[],
    judgeIds: list(o.judgeIds ?? o.judgeId, isUuid, 25),
    projectIds: list(o.projectIds, isUuid, 50),
  };
}

/** `judgeProjects` holds the ids of projects assigned to any of scope.judgeIds. */
export function inScope(
  p: Pick<ProjectRecord, "id" | "phaseId" | "status">,
  scope: ChatScope,
  judgeProjects: ReadonlySet<string>,
) {
  if (scope.projectIds.length && !scope.projectIds.includes(p.id)) return false;
  if (scope.judgeIds.length && !judgeProjects.has(p.id)) return false;
  if (scope.phaseIds.length && !(p.phaseId && scope.phaseIds.includes(p.phaseId))) return false;
  if (scope.statuses.length && !scope.statuses.includes(p.status)) return false;
  return true;
}

export type ChatThread = { id: string; title: string; scope: ChatScope; updatedAt: string };

type ThreadRow = { id: string; title: string; scope: unknown; updated_at: string };

const toThread = (r: ThreadRow): ChatThread => ({ id: r.id, title: r.title, scope: parseScope(r.scope), updatedAt: r.updated_at });

/** The signed-in admin's chats in a hackathon, most recent first. */
export async function listThreads(hackathonId: string): Promise<ChatThread[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, scope, updated_at")
    .eq("hackathon_id", hackathonId)
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<ThreadRow[]>();
  if (error) throw new Error(`Couldn't load your chats: ${error.message}`);
  return data.map(toThread);
}

/** One chat with its messages in order, or null. */
export async function getThread(
  hackathonId: string,
  id: string,
): Promise<{ thread: ChatThread; messages: UIMessage[] } | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, scope, updated_at, chat_messages(id, role, parts, metadata, position)")
    .eq("id", id)
    .eq("hackathon_id", hackathonId)
    .order("position", { referencedTable: "chat_messages" })
    .maybeSingle<
      ThreadRow & {
        chat_messages: { id: string; role: UIMessage["role"]; parts: UIMessage["parts"]; metadata: unknown }[];
      }
    >();
  if (error) throw new Error(`Couldn't load the chat: ${error.message}`);
  if (!data) return null;
  return {
    thread: toThread(data),
    messages: data.chat_messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      ...(m.metadata == null ? {} : { metadata: m.metadata }),
    })),
  };
}

/** A thread title from the first question: one line, at most 80 characters. */
export function titleFrom(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || "New chat";
}
