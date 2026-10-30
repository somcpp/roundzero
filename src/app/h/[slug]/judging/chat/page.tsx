import { notFound } from "next/navigation";
import { EMPTY_SCOPE, getThread, listThreads } from "@/lib/chat";
import { listJudgeDirectory } from "@/lib/judges";
import { getJudgingActivity, listPhases, listProjects } from "@/lib/judging";
import { getViewableHackathon } from "@/lib/hackathons";
import { CHAT_MODELS, TIER_MODEL_IDS, type ChatModelKey } from "@/lib/ai";
import type { ChatUIMessage } from "@/lib/chat-agent";
import { getIndexStatus } from "@/lib/project-index";
import { projectHeadline } from "@/lib/project-fields";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { ProjectChat, type ChatModelOption, type ChatProject } from "./project-chat";

/** A model picker choice with the Nebius model it runs, for the client. */
function modelOption(key: ChatModelKey): ChatModelOption {
  const { label, hint, tier } = CHAT_MODELS[key];
  return { label, hint, id: TIER_MODEL_IDS[tier] };
}

export default async function ChatPage({ params, searchParams }: PageProps<"/h/[slug]/judging/chat">) {
  const { slug } = await params;
  const { t } = await searchParams;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();

  const threadId = typeof t === "string" ? t : null;
  const [threads, current, phases, blocks, records, directory, activity, index] = await Promise.all([
    listThreads(hackathon.id),
    threadId ? getThread(hackathon.id, threadId) : null,
    listPhases(hackathon.id),
    listSchemaBlocks(hackathon.id),
    listProjects(hackathon.id),
    listJudgeDirectory(hackathon.id),
    getJudgingActivity(hackathon.id).catch(() => ({ assignments: [], agentReviews: [] })),
    getIndexStatus(hackathon.id),
  ]);

  const projects: ChatProject[] = records
    .map((p) => ({
      id: p.id,
      number: p.number,
      name: projectHeadline(p, blocks).name,
      phaseId: p.phaseId,
      status: p.status,
      // Assigned judges only; an admin's own review has no judge.
      judgeIds: [
        ...new Set(
          activity.assignments.flatMap((a) => (a.projectId === p.id && a.judgeId ? [a.judgeId] : [])),
        ),
      ],
    }))
    .sort((a, b) => a.number - b.number);

  return (
    <ProjectChat
      // A fresh chat state per thread; "new" until the first message saves it.
      key={current?.thread.id ?? "new"}
      slug={slug}
      models={{ fast: modelOption("fast"), smart: modelOption("smart") }}
      threadId={current?.thread.id ?? null}
      // Stored as the chat saved them; the route re-validates before the model sees them.
      initialMessages={(current?.messages ?? []) as ChatUIMessage[]}
      initialScope={current?.thread.scope ?? EMPTY_SCOPE}
      threads={threads}
      phases={phases.map((p) => ({ id: p.id, name: p.name }))}
      judges={directory.judges.map((j) => ({ id: j.id, name: j.name }))}
      projects={projects}
      index={{ total: index.total, indexed: index.indexed }}
    />
  );
}
