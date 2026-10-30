import type { LanguageModelUsage } from "ai";
import type { createClient } from "@/lib/supabase/server";
import { clip } from "./fetch";
import type { TokenUsage, TraceEntry } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_ENTRIES = 80;
const MAX_DETAIL = 4000;

/**
 * Keeps a step's trace ("how it got there") and what it's doing right now,
 * and writes both to its row every so often, so the project page can show
 * the agent working.
 */
export class StepRecorder {
  readonly trace: TraceEntry[] = [];
  readonly usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private activity = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: PromiseLike<unknown> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly supabase: Supabase,
    private readonly stepId: string,
  ) {}

  doing(activity: string) {
    this.activity = activity;
    this.schedule();
  }

  add(entry: Omit<TraceEntry, "at">) {
    if (this.trace.length >= MAX_ENTRIES) return;
    this.trace.push({
      at: new Date().toISOString(),
      ...entry,
      title: clip(entry.title, 300),
      ...(entry.detail ? { detail: clip(entry.detail, MAX_DETAIL) } : {}),
    });
    this.schedule();
  }

  addUsage(u: Pick<LanguageModelUsage, "inputTokens" | "outputTokens"> | TokenUsage | undefined) {
    this.usage.inputTokens += u?.inputTokens ?? 0;
    this.usage.outputTokens += u?.outputTokens ?? 0;
  }

  private schedule() {
    if (this.timer || this.closed) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.writing = this.supabase
        .from("agent_review_steps")
        .update({ activity: clip(this.activity, 290), trace: this.trace })
        .eq("id", this.stepId)
        .then(({ error }) => error && console.error("[agent] couldn't save progress:", error.message));
    }, 1200);
  }

  /** Stop writing progress; the caller saves the final state. */
  async close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.writing;
  }
}
