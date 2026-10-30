import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";
import type { Criterion, Hackathon, JudgeProfile, JudgingPhase, ProjectRecord, SchemaBlock } from "@/lib/data";
import { getAgentReview } from "@/lib/agent-reviews";
import { embedQuery, web } from "@/lib/ai";
import { inScope, type ChatScope } from "@/lib/chat";
import { listCriteria } from "@/lib/criteria";
import { listJudgeDirectory } from "@/lib/judges";
import { getJudgingActivity, getProjectWithEvents, listPhases, listProjects, type AgentReview, type Assignment } from "@/lib/judging";
import { formatNumber, hasValue, projectHeadline, valueText } from "@/lib/project-fields";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

// The judging chat agent: what it knows about the hackathon, and the tools it
// can call. Everything reads as the signed-in admin, so RLS applies.

export type ChatContext = {
  hackathon: Hackathon;
  blocks: SchemaBlock[];
  phases: JudgingPhase[];
  criteria: Criterion[];
  judges: JudgeProfile[];
  projects: ProjectRecord[];
  assignments: Assignment[];
  agentReviews: AgentReview[];
  scope: ChatScope;
  /** Projects the current scope covers. */
  scoped: ProjectRecord[];
};

export async function loadChatContext(hackathon: Hackathon, scope: ChatScope): Promise<ChatContext> {
  const [blocks, phases, criteria, directory, projects, activity] = await Promise.all([
    listSchemaBlocks(hackathon.id),
    listPhases(hackathon.id),
    listCriteria(hackathon.id),
    listJudgeDirectory(hackathon.id),
    listProjects(hackathon.id),
    // Judging may not have started; the chat still works without scores.
    getJudgingActivity(hackathon.id).catch(() => ({ assignments: [], agentReviews: [] })),
  ]);
  const judgeProjects = new Set(
    activity.assignments.filter((a) => a.judgeId && scope.judgeIds.includes(a.judgeId)).map((a) => a.projectId),
  );
  const scoped = projects.filter((p) => inScope(p, scope, judgeProjects)).sort((a, b) => a.number - b.number);
  return { hackathon, blocks, phases, criteria, judges: directory.judges, projects, ...activity, scope, scoped };
}

const projectPath = (ctx: ChatContext, n: number) => `/h/${ctx.hackathon.slug}/judging/projects/${n}`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function summary(ctx: ChatContext, p: ProjectRecord) {
  const { name, pitch } = projectHeadline(p, ctx.blocks);
  return {
    number: p.number,
    label: formatNumber(p.number),
    name,
    pitch: clip(pitch, 200),
    phase: ctx.phases.find((ph) => ph.id === p.phaseId)?.name ?? null,
    status: p.status,
    link: projectPath(ctx, p.number),
  };
}

function scopeLabel(ctx: ChatContext) {
  const { scope } = ctx;
  const phases = scope.phaseIds.map((id) => `"${ctx.phases.find((p) => p.id === id)?.name ?? "?"}"`);
  const judges = scope.judgeIds.map((id) => ctx.judges.find((j) => j.id === id)?.name ?? "a judge");
  const parts = [];
  if (phases.length) parts.push(`phase ${phases.join(" or ")}`);
  if (scope.statuses.length) parts.push(`status ${scope.statuses.join(" or ")}`);
  if (judges.length) parts.push(`assigned to ${judges.join(" or ")}`);
  if (scope.projectIds.length) parts.push(`${scope.projectIds.length} hand-picked projects`);
  return parts.length ? parts.join(", ") : "all projects";
}

export function systemPrompt(ctx: ChatContext) {
  const { hackathon } = ctx;
  const criteria = ctx.criteria
    .map((c) => `- ${c.title} (${c.scale === "score" ? `score, weight ${c.weight}` : "pass/fail"}${c.gate ? ", gate" : ""}): ${c.description}`)
    .join("\n");
  const phases = ctx.phases.map((p, i) => `${i + 1}. ${p.name}${p.advanceCount ? ` (top ${p.advanceCount} advance)` : ""}`).join("\n");
  const inScopeList = ctx.scoped
    .slice(0, 40)
    .map((p) => {
      const s = summary(ctx, p);
      return `- ${s.label} ${s.name}${s.pitch ? ` — ${s.pitch}` : ""} [${s.phase ?? "no phase"}, ${s.status}]`;
    })
    .join("\n");

  return `You are the judging assistant for "${hackathon.name}"${hackathon.tagline ? ` (${hackathon.tagline})` : ""}, helping the organizer review hackathon submissions. Today is ${new Date().toISOString().slice(0, 10)}.

## Scope
The organizer is chatting about ${ctx.scoped.length} of ${ctx.projects.length} projects (${scopeLabel(ctx)}). Stay within this scope unless asked otherwise.
${inScopeList || "(no projects in scope)"}${ctx.scoped.length > 40 ? `\n…and ${ctx.scoped.length - 40} more (use listProjects).` : ""}

## Judging criteria
${criteria || "(none set up yet)"}

## Phases
${phases || "(none)"}

## Tools
- searchProjects: semantic search over every submission and the pages they link to (repo README, demo site). Use it for questions about what projects do, how they're built, or finding similar ideas.
- listProjects / getProject: exact data — fields, phase, status, audit trail and notes.
- judgingScores: agent and judge scores, and who reviewed what.
- agentReview: the agent's review of one project, criterion by criterion: score, confidence, reasoning, evidence, feedback, and anything flagged for a person.
- webSearch / readWebPage: the live web, via Tavily. Use for checking claims, prior art, a team's public repo, or anything outside the submissions.

## How to answer
- Ground every claim in tool results; never invent scores, projects or quotes. If the data isn't there, say so.
- Refer to projects as markdown links using their number and name, e.g. [#007 Repo Whisperer](${projectPath(ctx, 7)}).
- Cite web sources inline as markdown links, e.g. [Trunk](https://trunk.io). Never use bracket citation markers like 【…】 or [1].
- For questions about what projects do or how they compare, call searchProjects first rather than reading projects one by one.
- Be concise and scannable: short paragraphs, bullet lists, and tables when comparing projects.`;
}

export function buildTools(ctx: ChatContext) {
  const byNumber = (n: number) => ctx.projects.find((p) => p.number === n);
  const judgeName = (id: string) => ctx.judges.find((j) => j.id === id)?.name ?? "Unknown judge";

  return {
    searchProjects: tool({
      description:
        "Semantic search over project submissions and the web pages they link to (repos, demos). Returns the best-matching passages with their project.",
      inputSchema: z.object({
        query: z.string().min(2).describe("What to look for, in natural language"),
        limit: z.number().int().min(1).max(12).optional().describe("Max passages, default 8"),
        allProjects: z.boolean().optional().describe("Search every project instead of only the current scope"),
      }),
      execute: async ({ query, limit = 8, allProjects = false }) => {
        const supabase = await createClient();
        const everything = allProjects || ctx.scoped.length === ctx.projects.length;
        if (!everything && ctx.scoped.length === 0) return { results: [], note: "No projects in scope." };
        const { data, error } = await supabase.rpc("match_project_chunks", {
          p_hackathon_id: ctx.hackathon.id,
          p_query: JSON.stringify(await embedQuery(query)),
          p_count: limit,
          p_project_ids: everything ? null : ctx.scoped.map((p) => p.id),
        });
        if (error) return { results: [], note: `Search failed: ${error.message}` };
        const rows = data as { project_id: string; number: number; source: string; source_url: string | null; content: string; similarity: number }[];
        if (rows.length === 0) return { results: [], note: "Nothing indexed yet. Projects are indexed when saved; use Reindex in the sidebar." };
        return {
          results: rows.map((r) => {
            const p = byNumber(r.number);
            return {
              project: formatNumber(r.number),
              name: p ? projectHeadline(p, ctx.blocks).name : null,
              link: projectPath(ctx, r.number),
              source: r.source === "web" ? `linked page ${r.source_url}` : "submission",
              similarity: Math.round(r.similarity * 100) / 100,
              excerpt: clip(r.content, 900),
            };
          }),
        };
      },
    }),

    listProjects: tool({
      description: "List projects with name, pitch, phase and status. Defaults to the chat's scope.",
      inputSchema: z.object({
        allProjects: z.boolean().optional().describe("List every project instead of only the current scope"),
        status: z.enum(["active", "eliminated", "disqualified"]).optional(),
      }),
      execute: async ({ allProjects = false, status }) => {
        const list = (allProjects ? ctx.projects : ctx.scoped).filter((p) => !status || p.status === status);
        return { count: list.length, projects: list.slice(0, 80).map((p) => summary(ctx, p)) };
      },
    }),

    getProject: tool({
      description: "Everything about one project: every submitted field, phase, status and its audit trail (notes, moves, scores).",
      inputSchema: z.object({ number: z.number().int().positive().describe("The project number, e.g. 7 for #007") }),
      execute: async ({ number }) => {
        const found = await getProjectWithEvents(ctx.hackathon.id, number);
        if (!found) return { error: `There's no project ${formatNumber(number)}.` };
        const { project, events } = found;
        const fields = Object.fromEntries(
          ctx.blocks.filter((b) => hasValue(project.values[b.id])).map((b) => [b.title, clip(valueText(project.values[b.id]), 3000)]),
        );
        return {
          ...summary(ctx, project),
          inScope: ctx.scoped.some((p) => p.id === project.id),
          fields,
          events: events.slice(0, 30).map((e) => ({ kind: e.kind, by: e.actorName || e.actorKind, at: e.createdAt, data: e.data })),
        };
      },
    }),

    judgingScores: tool({
      description:
        "Agent review results and judge scores for projects: who is assigned, who has submitted, the scores, and the average. Defaults to the chat's scope.",
      inputSchema: z.object({
        numbers: z.array(z.number().int().positive()).max(50).optional().describe("Limit to these project numbers"),
      }),
      execute: async ({ numbers }) => {
        const list = numbers?.length ? ctx.projects.filter((p) => numbers.includes(p.number)) : ctx.scoped;
        if (ctx.assignments.length === 0 && ctx.agentReviews.length === 0) {
          return { note: "Judging hasn't started, so there are no scores yet." };
        }
        return {
          projects: list.slice(0, 60).map((p) => {
            const review = ctx.agentReviews.find((r) => r.projectId === p.id);
            const reviews = ctx.assignments
              .filter((a) => a.projectId === p.id)
              .map((a) => ({
                // An admin's own review has no judge.
                judge: a.judgeId ? judgeName(a.judgeId) : "An admin (their own score)",
                phase: ctx.phases.find((ph) => ph.id === a.phaseId)?.name ?? null,
                score: a.submittedAt ? a.score : null,
                submitted: Boolean(a.submittedAt),
              }));
            const scores = reviews.map((r) => r.score).filter((s): s is number => s !== null);
            return {
              project: formatNumber(p.number),
              name: projectHeadline(p, ctx.blocks).name,
              link: projectPath(ctx, p.number),
              agent: review ? { status: review.status, total: review.total, gatePassed: review.gatePassed } : null,
              judgeAverage: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
              reviews,
            };
          }),
        };
      },
    }),

    agentReview: tool({
      description:
        "The agent's review of one project: each criterion's score or pass/fail (with any admin override), confidence, reasoning, evidence, feedback for the team, and what's flagged for a person.",
      inputSchema: z.object({ number: z.number().int().positive().describe("The project number, e.g. 7 for #007") }),
      execute: async ({ number }) => {
        const p = byNumber(number);
        if (!p) return { error: `There's no project ${formatNumber(number)}.` };
        const review = await getAgentReview(p.id);
        if (!review) return { note: "The agent hasn't reviewed this project yet." };
        return {
          project: formatNumber(number),
          link: `${projectPath(ctx, number)}#agent`,
          status: review.status,
          total: review.total,
          gatePassed: review.gatePassed,
          flaggedSteps: review.flagged,
          summary: review.summary,
          steps: ctx.criteria.map((c) => {
            const s = review.steps.find((x) => x.criterionId === c.id);
            if (!s) return { criterion: c.title, status: "not reviewed" };
            return {
              criterion: c.title,
              status: s.status,
              score: s.override ? s.override.score : s.score,
              passed: s.override ? s.override.passed : s.passed,
              override: s.override ? { agentSaid: s.score ?? s.passed, note: s.override.note } : null,
              confidence: s.confidence,
              reasoning: clip(s.reasoning, 1500),
              evidence: s.evidence.slice(0, 6),
              feedback: s.feedback,
              flags: s.flags,
              needsPerson: s.needsReview ? s.reviewReason || true : false,
              model: s.model,
            };
          }),
        };
      },
    }),

    webSearch: tool({
      description: "Search the live web with Tavily. Returns a short answer and the top results with snippets and URLs.",
      inputSchema: z.object({
        query: z.string().min(2),
        maxResults: z.number().int().min(1).max(8).optional().describe("Default 5"),
        topic: z.enum(["general", "news"]).optional(),
      }),
      execute: async ({ query, maxResults = 5, topic = "general" }) => {
        try {
          const res = await web.search(query, { maxResults, topic, includeAnswer: "basic", searchDepth: "basic" });
          return {
            answer: res.answer ?? null,
            results: res.results.map((r) => ({ title: r.title, url: r.url, snippet: clip(r.content ?? "", 600) })),
          };
        } catch (e) {
          return { error: `Web search failed: ${e instanceof Error ? e.message : String(e)}`, results: [] };
        }
      },
    }),

    readWebPage: tool({
      description: "Read one web page (e.g. a project's GitHub repo or live demo) as markdown, via Tavily.",
      inputSchema: z.object({ url: z.url() }),
      execute: async ({ url }) => {
        try {
          const res = await web.extract([url], { format: "markdown", extractDepth: "basic" });
          const page = res.results[0];
          if (!page) return { url, error: "Couldn't read that page." };
          return { url: page.url, title: page.title, content: clip(page.rawContent, 10000) };
        } catch (e) {
          return { url, error: `Couldn't read that page: ${e instanceof Error ? e.message : String(e)}` };
        }
      },
    }),
  };
}

export type ChatTools = InferUITools<ReturnType<typeof buildTools>>;
export type ChatUIMessage = UIMessage<unknown, UIDataTypes, ChatTools>;
