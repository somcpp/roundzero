import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai";
import { CHAT_MODELS, parseChatModel, tierModel } from "@/lib/ai";
import { getThread, parseScope, titleFrom } from "@/lib/chat";
import { buildTools, loadChatContext, systemPrompt, type ChatUIMessage } from "@/lib/chat-agent";
import { getHackathon } from "@/lib/hackathons";
import { createClient } from "@/lib/supabase/server";

// The judging chat. The client sends only its newest message; history comes
// from public.chat_messages and the full thread is saved back when the reply ends.

export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: RouteContext<"/api/h/[slug]/chat">) {
  const { slug } = await params;
  const hackathon = await getHackathon(slug);
  if (!hackathon) return Response.json({ error: "Hackathon not found, or your session expired." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const threadId = body?.id;
  const message = body?.message as ChatUIMessage | undefined;
  if (typeof threadId !== "string" || !UUID.test(threadId) || !message || message.role !== "user") {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const scope = parseScope(body.scope);
  const model = CHAT_MODELS[parseChatModel(body.model)];
  const supabase = await createClient();

  const existing = await getThread(hackathon.id, threadId);
  if (!existing) {
    const question = message.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
    const { error } = await supabase
      .from("chat_threads")
      .insert({ id: threadId, hackathon_id: hackathon.id, title: titleFrom(question), scope });
    if (error) return Response.json({ error: `Couldn't start the chat: ${error.message}` }, { status: 403 });
  } else if (JSON.stringify(existing.thread.scope) !== JSON.stringify(scope)) {
    await supabase.from("chat_threads").update({ scope }).eq("id", threadId);
  }

  // A message already in the thread means an edit or regenerate: drop what came after it.
  const history = (existing?.messages ?? []) as ChatUIMessage[];
  const at = history.findIndex((m) => m.id === message.id);
  const incoming = at === -1 ? [...history, message] : [...history.slice(0, at), message];

  const context = await loadChatContext(hackathon, scope);
  const tools = buildTools(context);
  const messages = await validateUIMessages<ChatUIMessage>({ messages: incoming, tools });

  const result = streamText({
    model: tierModel(model.tier),
    instructions: systemPrompt(context),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(10),
  });
  // Finish (and save) even if the browser goes away mid-reply.
  result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<typeof tools, ChatUIMessage>({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: async ({ messages: all }) => {
        const { error } = await supabase.rpc("save_chat_messages", { p_thread_id: threadId, p_messages: all });
        if (error) console.error("[chat] couldn't save messages:", error.message);
      },
      onError: (e) => {
        console.error("[chat]", e);
        return e instanceof Error ? e.message : "Something went wrong.";
      },
    }),
  });
}
