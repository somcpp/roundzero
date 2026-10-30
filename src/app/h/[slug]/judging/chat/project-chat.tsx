"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatStatus } from "ai";
import { ChevronDownIcon } from "lucide-react";
import type { ExtraProps } from "streamdown";
import {
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Button, ComboBox, Description, Dropdown, Input, Label, ListBox } from "@heroui/react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { ConfirmButton } from "@/components/confirm-button";
import { fieldLabelClass } from "@/components/controls";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { Avatar, Chip, Eyebrow, cn } from "@/components/ui";
import type { ChatModelKey } from "@/lib/ai";
import type { ChatScope, ChatThread } from "@/lib/chat";
import { deleteThread, reindexProjects } from "@/lib/chat-actions";
import type { ChatUIMessage } from "@/lib/chat-agent";
import type { IconName, ProjectStatus } from "@/lib/data";
import { formatNumber } from "@/lib/project-fields";

export type ChatProject = {
  id: string;
  number: number;
  name: string;
  phaseId: string | null;
  status: ProjectStatus;
  judgeIds: string[];
};

/** One choice in the model picker; `id` is the Nebius model it runs. */
export type ChatModelOption = { label: string; hint: string; id: string };

type Named = { id: string; name: string };

const STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "eliminated", label: "Eliminated" },
  { id: "disqualified", label: "Disqualified" },
];

const SUGGESTIONS = [
  "Summarize the projects in scope",
  "Which projects are most similar to each other?",
  "Who scored furthest from the agent, and why?",
  "Check if the top project's idea already exists on the web",
];

const MODEL_ICONS: Record<ChatModelKey, IconName> = { fast: "play", smart: "spark" };
const MODEL_STORAGE_KEY = "judging-chat-model";

// The last pick is read once per render; nothing else writes it, so there's nothing to subscribe to.
const noSubscribe = () => () => {};
const storedModel = () => {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
};

/** "Round 1", "Round 1, Final", or "3 phases" once there are more. */
const few = (names: string[], noun: string) =>
  names.length === 0 ? null : names.length <= 2 ? names.join(", ") : `${names.length} ${noun}`;

export function ProjectChat({
  slug,
  models,
  threadId,
  initialMessages,
  initialScope,
  threads,
  phases,
  judges,
  projects,
  index,
}: {
  slug: string;
  models: Record<ChatModelKey, ChatModelOption>;
  threadId: string | null;
  initialMessages: ChatUIMessage[];
  initialScope: ChatScope;
  threads: ChatThread[];
  phases: Named[];
  judges: Named[];
  projects: ChatProject[];
  index: { total: number; indexed: number };
}) {
  const router = useRouter();
  // A new chat gets its id up front; the server creates the thread on the first message.
  const [chatId] = useState(() => threadId ?? crypto.randomUUID());
  const [saved, setSaved] = useState(threadId !== null);
  const [firstQuestion, setFirstQuestion] = useState("");
  // Ids that no longer exist (a deleted phase, judge or project) would filter invisibly; drop them.
  const [scope, setScope] = useState<ChatScope>(() => {
    const known = (ids: string[], list: { id: string }[]) => ids.filter((id) => list.some((x) => x.id === id));
    return {
      ...initialScope,
      phaseIds: known(initialScope.phaseIds, phases),
      judgeIds: known(initialScope.judgeIds, judges),
      projectIds: known(initialScope.projectIds, projects),
    };
  });
  const [draft, setDraft] = useState("");
  // Demo accounts can read saved chats but not ask: every question runs the model.
  const readOnly = useReadOnly();

  // Smart unless this browser picked otherwise; the server render always says Smart.
  const stored = useSyncExternalStore(noSubscribe, storedModel, () => null);
  const [picked, setPicked] = useState<ChatModelKey | null>(null);
  const modelKey: ChatModelKey = picked ?? (stored && Object.hasOwn(models, stored) ? (stored as ChatModelKey) : "smart");
  const pickModel = (key: ChatModelKey) => {
    setPicked(key);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, key);
    } catch {
      // Storage is blocked; the pick lasts until the page reloads.
    }
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `/api/h/${slug}/chat`,
        // History lives on the server; send only the newest message, the scope and the model.
        prepareSendMessagesRequest: ({ id, messages, body }) => ({ body: { ...body, id, message: messages.at(-1) } }),
      }),
    [slug],
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: ({ isError }) => {
      if (saved || isError) return;
      setSaved(true);
      // Point the URL at the new thread without reloading the page.
      window.history.replaceState(null, "", `?t=${chatId}`);
    },
  });

  const scoped = projects.filter(
    (p) =>
      (!scope.projectIds.length || scope.projectIds.includes(p.id)) &&
      (!scope.phaseIds.length || (p.phaseId !== null && scope.phaseIds.includes(p.phaseId))) &&
      (!scope.statuses.length || scope.statuses.includes(p.status)) &&
      (!scope.judgeIds.length || p.judgeIds.some((id) => scope.judgeIds.includes(id))),
  );

  const send = (text: string) => {
    const q = text.trim();
    if (readOnly || !q || status === "submitted" || status === "streaming") return;
    if (!saved && !firstQuestion) setFirstQuestion(q);
    sendMessage({ text: q }, { body: { scope, model: modelKey } });
    setDraft("");
  };

  // Show the new thread in the list as soon as it's asked, before the server list catches up.
  const allThreads =
    firstQuestion && !threads.some((t) => t.id === chatId)
      ? [{ id: chatId, title: firstQuestion, scope, updatedAt: new Date().toISOString() }, ...threads]
      : threads;

  const nameOf = (list: Named[], id: string) => list.find((x) => x.id === id)?.name ?? [];
  const scopeLabels = [
    few(scope.phaseIds.flatMap((id) => nameOf(phases, id)), "phases"),
    few(scope.statuses.map((s) => STATUSES.find((x) => x.id === s)?.label ?? s), "statuses"),
    few(scope.judgeIds.flatMap((id) => nameOf(judges, id)), "judges"),
    scope.projectIds.length > 0 && `${scope.projectIds.length} picked`,
  ].filter((x): x is string => Boolean(x));

  return (
    <div data-bleed className="grid min-h-0 w-full flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
      <aside className="hidden min-h-0 flex-col border-r-2 border-border lg:flex">
        <div className="flex items-center gap-2 border-b-2 border-border p-4">
          <ThreadPicker slug={slug} threads={allThreads} currentId={saved || firstQuestion ? chatId : null} />
          {saved && (
            <ConfirmButton
              isIconOnly
              variant="ghost"
              size="sm"
              aria-label="Delete this chat"
              title="Delete this chat?"
              description={`"${allThreads.find((t) => t.id === chatId)?.title ?? "This chat"}" and its messages will be gone for good.`}
              confirmLabel="Delete chat"
              pendingLabel="Deleting…"
              onConfirm={async () => {
                const res = await deleteThread(slug, chatId);
                if ("error" in res) return res.error;
                router.push(`/h/${slug}/judging/chat`);
              }}
            >
              <PixelIcon name="trash" size={12} />
            </ConfirmButton>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label="New chat"
            onPress={() => router.push(`/h/${slug}/judging/chat`)}
          >
            <PixelIcon name="plus" size={12} />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <ScopeFilters scope={scope} setScope={setScope} phases={phases} judges={judges} projects={projects} />
          <div className="rounded-lg border-2 border-accent/30 bg-accent-soft px-4 py-3 text-sm">
            <b className="font-pixel">{scoped.length}</b> of {projects.length} projects in scope
            <div className="mt-0.5 text-xs text-muted">{scopeLabels.join(" · ") || "Everything"}</div>
          </div>
          <IndexStatus slug={slug} index={index} />
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3 text-xs">
          <span className="text-muted">Chatting with</span>
          <Chip className="py-0.5 text-xs">{scoped.length} projects</Chip>
          {scopeLabels.map((l) => (
            <Chip key={l} className="py-0.5 text-xs">
              {l}
            </Chip>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-muted">
            <PixelIcon name={MODEL_ICONS[modelKey]} size={10} /> {models[modelKey].id.split("/").pop()} · Nebius
          </span>
        </header>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-6 py-8">
            {messages.length === 0 ? (
              <ConversationEmptyState
                className="pt-16"
                icon={
                  <span className="grid size-12 place-items-center rounded-lg bg-foreground text-background">
                    <PixelIcon name="spark" size={20} />
                  </span>
                }
                title={`Ask about ${scoped.length} project${scoped.length === 1 ? "" : "s"}`}
                description="Searches submissions and the repos and demos they link to, reads scores and notes, and can look things up on the web."
              />
            ) : (
              messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  streaming={i === messages.length - 1 && status === "streaming"}
                />
              ))
            )}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm">
                <Shimmer>Thinking…</Shimmer>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
                <span>{error.message || "Something went wrong."}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={readOnly}
                  onPress={() => regenerate({ body: { scope, model: modelKey } })}
                >
                  Retry
                </Button>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 pb-6">
          {messages.length === 0 && !readOnly && (
            <Suggestions>
              {SUGGESTIONS.map((s) => (
                <Suggestion key={s} suggestion={s} onClick={send} />
              ))}
            </Suggestions>
          )}
          <PromptInput onSubmit={({ text }) => send(text)} className="rounded-xl bg-white">
            <PromptInputBody>
              <PromptInputTextarea
                value={draft}
                disabled={readOnly}
                onChange={(e) => setDraft(e.currentTarget.value)}
                placeholder={readOnly ? "Chat is off for demo accounts. Saved chats are still here to read." : `Ask about these ${scoped.length} projects…`}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <ModelPicker models={models} value={modelKey} onChange={pickModel} />
                <span className="hidden px-2 text-xs text-muted sm:inline">Project search · scores · web (Tavily)</span>
              </PromptInputTools>
              <PromptInputSubmit
                status={status as ChatStatus}
                onStop={stop}
                disabled={readOnly || (!draft.trim() && status !== "streaming" && status !== "submitted")}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>
    </div>
  );
}

/** Fast or Smart, for the next message. */
function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: Record<ChatModelKey, ChatModelOption>;
  value: ChatModelKey;
  onChange: (key: ChatModelKey) => void;
}) {
  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`Model: ${models[value].label}`}
        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted transition hover:bg-surface-secondary hover:text-foreground data-[pressed]:bg-surface-secondary"
      >
        <PixelIcon name={MODEL_ICONS[value]} size={10} />
        {models[value].label}
        <PixelIcon name="arrow-down" size={8} />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top start" className="w-72">
        <Dropdown.Menu
          aria-label="Model"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value]}
          onSelectionChange={(keys) => {
            const key = keys === "all" ? undefined : [...keys][0];
            if (typeof key === "string" && Object.hasOwn(models, key)) onChange(key as ChatModelKey);
          }}
        >
          {(Object.keys(models) as ChatModelKey[]).map((key) => (
            <Dropdown.Item key={key} id={key} textValue={models[key].label}>
              <Dropdown.ItemIndicator type="dot" />
              <PixelIcon name={MODEL_ICONS[key]} size={12} className="shrink-0 text-muted" />
              <span className="flex min-w-0 flex-col">
                <Label>{models[key].label}</Label>
                <Description>{models[key].hint}</Description>
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function ScopeFilters({
  scope,
  setScope,
  phases,
  judges,
  projects,
}: {
  scope: ChatScope;
  setScope: (fn: (s: ChatScope) => ChatScope) => void;
  phases: Named[];
  judges: Named[];
  projects: ChatProject[];
}) {
  const update = (patch: Partial<ChatScope>) => setScope((s) => ({ ...s, ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base leading-none">Scope</h2>

      <ScopeCombo
        label="Projects"
        placeholder="Pick projects…"
        options={projects.map((p) => ({ id: p.id, label: p.name, prefix: formatNumber(p.number) }))}
        value={scope.projectIds}
        onChange={(projectIds) => update({ projectIds })}
      />

      {phases.length > 0 && (
        <ScopeCombo
          label="Phase"
          placeholder="Any phase"
          options={phases.map((p) => ({ id: p.id, label: p.name }))}
          value={scope.phaseIds}
          onChange={(phaseIds) => update({ phaseIds })}
        />
      )}

      <ScopeCombo
        label="Status"
        placeholder="Any status"
        options={STATUSES}
        value={scope.statuses}
        // Keys only come from STATUSES.
        onChange={(ids) => update({ statuses: ids as ProjectStatus[] })}
      />

      {judges.length > 0 && (
        <ScopeCombo
          label="Judge"
          placeholder="Any judge"
          options={judges.map((j) => ({
            id: j.id,
            label: j.name,
            icon: <Avatar name={j.name} size={16} className="rounded-[2px]" />,
          }))}
          value={scope.judgeIds}
          onChange={(judgeIds) => update({ judgeIds })}
        />
      )}
    </div>
  );
}

type ScopeOption = { id: string; label: string; prefix?: string; icon?: ReactNode };

/** A multi-select filter: type to narrow the list; picks show below as chips that remove on click. */
function ScopeCombo({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: readonly ScopeOption[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  const picked = options.filter((o) => value.includes(o.id));

  return (
    <ComboBox fullWidth selectionMode="multiple" value={value} onChange={(keys) => onChange(keys.map(String))}>
      <Label className={fieldLabelClass}>{label}</Label>
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Value className="flex flex-wrap gap-1.5 pt-1">
        {picked.map((o) => (
          <Chip
            key={o.id}
            active
            onClick={() => onChange(value.filter((id) => id !== o.id))}
            title="Remove from scope"
            className="py-0.5 text-xs"
          >
            {o.icon}
            {o.prefix && `${o.prefix} `}
            {o.label}
            <PixelIcon name="x" size={8} />
          </Chip>
        ))}
      </ComboBox.Value>
      <ComboBox.Popover>
        <ListBox selectionMode="multiple">
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.prefix ? `${o.prefix} ${o.label}` : o.label} className="gap-2">
              {o.icon}
              {o.prefix && <span className="shrink-0 font-pixel text-xs text-muted">{o.prefix}</span>}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

function IndexStatus({ slug, index }: { slug: string; index: { total: number; indexed: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>();
  const behind = index.total - index.indexed;
  const readOnly = useReadOnly();

  const run = (all: boolean) =>
    start(async () => {
      setMessage(undefined);
      const res = await reindexProjects(slug, all);
      if ("error" in res) setMessage(res.error);
      else {
        setMessage(`Indexed ${res.indexed}${res.failed ? `, ${res.failed} failed` : ""}.`);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Project search index</Eyebrow>
        <span className={cn("font-pixel text-xs", behind ? "text-warning" : "text-success")}>
          {index.indexed}/{index.total}
        </span>
      </div>
      <p className="text-xs text-muted">
        {behind
          ? `${behind} project${behind === 1 ? " isn't" : "s aren't"} embedded yet or changed since.`
          : "Every project is embedded, with its linked repo and demo pages."}
      </p>
      <div className="flex gap-2">
        {behind > 0 && (
          <Button size="sm" variant="primary" isDisabled={readOnly || pending} onPress={() => run(false)}>
            {pending ? "Indexing…" : `Index ${behind}`}
          </Button>
        )}
        <Button size="sm" variant="ghost" isDisabled={readOnly || pending || index.total === 0} onPress={() => run(true)}>
          {pending && behind === 0 ? "Reindexing…" : "Reindex all"}
        </Button>
      </div>
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}

/** Switch between saved chats. Delete and new-chat sit beside it, so the menu stays a plain list. */
function ThreadPicker({ slug, threads, currentId }: { slug: string; threads: ChatThread[]; currentId: string | null }) {
  const router = useRouter();
  const current = threads.find((t) => t.id === currentId);

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Switch chat"
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border-2 border-border bg-surface px-3 text-left text-sm transition hover:border-border-strong data-[pressed]:bg-surface-secondary"
      >
        <PixelIcon name="chat" size={12} className="shrink-0 text-muted" />
        <span className={cn("min-w-0 flex-1 truncate", !current && "text-muted")}>{current?.title ?? "New chat"}</span>
        <PixelIcon name="arrow-down" size={10} className="shrink-0 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className="max-h-96 w-72 overflow-y-auto">
        <Dropdown.Menu
          aria-label="Your chats"
          onAction={(key) => router.push(`/h/${slug}/judging/chat?t=${key}`)}
          renderEmptyState={() => <p className="px-3 py-2 text-sm text-muted">Your chats show up here.</p>}
        >
          {threads.map((t) => (
            <Dropdown.Item key={t.id} id={t.id} textValue={t.title}>
              <PixelIcon
                name={t.id === currentId ? "check" : "chat"}
                size={12}
                className={cn("shrink-0", t.id === currentId ? "text-accent" : "text-muted")}
              />
              <Label className="min-w-0 flex-1 truncate">{t.title}</Label>
              <span className="shrink-0 text-xs text-muted">{ago(t.updatedAt)}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** "now", "5m", "3h", "2d" */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}

// ── Messages ───────────────────────────────────────────────────────────────

type Part = ChatUIMessage["parts"][number];
type ToolPart = Extract<Part, { type: `tool-${string}` }>;
type Segment = { kind: "text"; text: string; index: number } | { kind: "activity"; parts: Part[]; index: number };

const isToolPart = (p: Part): p is ToolPart => p.type.startsWith("tool-");

/** Text parts as they are; each run of reasoning and tool calls between them folded into one activity row. */
function segments(parts: Part[]): Segment[] {
  const out: Segment[] = [];
  parts.forEach((p, index) => {
    if (p.type === "text") {
      // Nemotron sometimes leaves citation markers like 【webSearch†L13】 despite the prompt.
      const text = p.text.replace(/【[^】]*】/g, "");
      if (text.trim()) out.push({ kind: "text", text, index });
    } else if ((p.type === "reasoning" && p.text.trim()) || isToolPart(p)) {
      const prev = out.at(-1);
      if (prev?.kind === "activity") prev.parts.push(p);
      else out.push({ kind: "activity", parts: [p], index });
    }
  });
  return out;
}

function ChatMessage({ message, streaming }: { message: ChatUIMessage; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent className="group-[.is-user]:bg-accent-soft group-[.is-user]:text-accent-soft-foreground">
          {message.parts.map((p, i) => (p.type === "text" ? <p key={i} className="whitespace-pre-wrap">{p.text}</p> : null))}
        </MessageContent>
      </Message>
    );
  }

  const segs = segments(message.parts);
  const sources = webSources(message.parts);
  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className="w-full gap-4">
        {segs.map((seg, i) => {
          const live = streaming && i === segs.length - 1;
          return seg.kind === "text" ? (
            <MessageResponse key={seg.index} components={{ a: ChatLink }} isAnimating={live}>
              {seg.text}
            </MessageResponse>
          ) : (
            <Activity key={seg.index} parts={seg.parts} live={live} />
          );
        })}
        {!streaming && sources.length > 0 && (
          <Sources className="mb-0">
            <SourcesTrigger count={sources.length} />
            <SourcesContent>
              {sources.map((r) => (
                <Source key={r.url} href={r.url} title={r.title} />
              ))}
            </SourcesContent>
          </Sources>
        )}
      </MessageContent>
    </Message>
  );
}

/** Every web page the reply searched or read, once each. */
function webSources(parts: Part[]) {
  const seen = new Map<string, { url: string; title: string }>();
  for (const p of parts) {
    if (p.type === "tool-webSearch" && p.state === "output-available") {
      for (const r of p.output.results) seen.set(r.url, { url: r.url, title: r.title || r.url });
    } else if (p.type === "tool-readWebPage" && p.state === "output-available" && !("error" in p.output && p.output.error)) {
      seen.set(p.output.url, { url: p.output.url, title: ("title" in p.output && p.output.title) || p.output.url });
    }
  }
  return [...seen.values()];
}

const TOOL_LABELS: Record<ToolPart["type"], string> = {
  "tool-searchProjects": "Searched projects",
  "tool-listProjects": "Listed projects",
  "tool-getProject": "Read project",
  "tool-judgingScores": "Read scores",
  "tool-agentReview": "Read the agent's review of",
  "tool-webSearch": "Searched the web",
  "tool-readWebPage": "Read a web page",
};

function toolTitle(part: ToolPart) {
  const input = part.input as Record<string, unknown> | undefined;
  const detail =
    (typeof input?.query === "string" && `“${input.query}”`) ||
    (typeof input?.number === "number" && formatNumber(input.number)) ||
    (typeof input?.url === "string" && input.url) ||
    "";
  return `${TOOL_LABELS[part.type]}${detail ? ` ${detail}` : ""}`;
}

/** "Searched projects, read 3 projects and searched the web" */
function activitySummary(tools: ToolPart[]) {
  const count = (type: ToolPart["type"]) => tools.filter((t) => t.type === type).length;
  const phrases = [
    count("tool-searchProjects") && "searched projects",
    count("tool-listProjects") && "listed projects",
    count("tool-getProject") && `read ${count("tool-getProject")} project${count("tool-getProject") === 1 ? "" : "s"}`,
    count("tool-judgingScores") && "checked scores",
    count("tool-agentReview") && `read ${count("tool-agentReview")} agent review${count("tool-agentReview") === 1 ? "" : "s"}`,
    count("tool-webSearch") && "searched the web",
    count("tool-readWebPage") && `read ${count("tool-readWebPage")} web page${count("tool-readWebPage") === 1 ? "" : "s"}`,
  ].filter((x): x is string => Boolean(x));
  if (!phrases.length) return "Thought it through";
  const text = phrases.length > 1 ? `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}` : phrases[0];
  return text[0].toUpperCase() + text.slice(1);
}

function Activity({ parts, live }: { parts: Part[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  const tools = parts.filter(isToolPart);
  const current = parts.at(-1);
  const failed = tools.some((t) => t.state === "output-error");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted transition hover:text-foreground">
        <PixelIcon name="spark" size={12} className={live ? "text-accent" : undefined} />
        {live ? (
          <Shimmer>{current && isToolPart(current) ? `${toolTitle(current)}…` : "Thinking…"}</Shimmer>
        ) : (
          <span>
            {activitySummary(tools)}
            {failed && " · a step failed"}
          </span>
        )}
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 flex flex-col gap-3 border-l-2 border-border pl-4">
        {parts.map((p, i) =>
          isToolPart(p) ? (
            <Tool key={i} className="mb-0">
              <ToolHeader type={p.type} state={p.state} title={toolTitle(p)} />
              <ToolContent>
                <ToolInput input={p.input} />
                <ToolOutput output={p.output} errorText={p.errorText} />
              </ToolContent>
            </Tool>
          ) : p.type === "reasoning" ? (
            <p key={i} className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
              {p.text.trim()}
            </p>
          ) : null,
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Links in answers: project links stay in the app, everything else opens in a new tab. */
function ChatLink({ href = "", children, className }: ComponentProps<"a"> & ExtraProps) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cn("font-medium text-accent underline underline-offset-4", className)}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("font-medium text-accent underline underline-offset-4", className)}
    >
      {children}
    </a>
  );
}
