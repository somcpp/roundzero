import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";
import { Resend } from "resend";
import { FatalError, RetryableError } from "workflow";
import { emailConfig, isReservedAddress, sender } from "@/lib/email/config";
import { createAdminClient } from "@/lib/supabase/admin";

// Sends one email through Resend and records it in public.email_sends
// (supabase/migrations/*_email_delivery.sql). Called from workflow steps
// (src/workflows/*), which retry on a thrown error, so every send is keyed:
// the same dedupe key never goes out twice, however often a step reruns.

export type EmailKind =
  | "judge_invite"
  | "judge_batch"
  | "judge_last_call"
  | "owner_phase_done"
  | "owner_phase_due"
  | "agent_inbox"
  | "winner"
  | "thank_you";

export type Outgoing = {
  hackathonId: string;
  kind: EmailKind;
  /** Unique within the hackathon. Once an email with this key is sent, sending it again does nothing. */
  dedupeKey: string;
  to: string;
  /** Sender display name; the address is always FROM_EMAIL. */
  fromName: string;
  replyTo?: string | null;
  subject: string;
  element: ReactElement;
  phaseId?: string | null;
  judgeId?: string | null;
  projectId?: string | null;
};

/** "failed" means Resend refused it for good (bad address, quota); the reason is on the row. */
export type Delivery = "sent" | "already sent" | "skipped" | "failed";

/** Resend errors worth trying again: its rate limit, a concurrent retry of the same key, or its side being down. */
const RETRYABLE = new Set(["rate_limit_exceeded", "concurrent_idempotent_requests", "application_error", "internal_server_error"]);

export function adminDb() {
  const db = createAdminClient();
  if (!db) throw new FatalError("SUPABASE_SECRET_KEY isn't set, so emails can't be sent from the background.");
  return db;
}

/** Claim the email's row, or learn it already went out. Returns the row id and which attempt this is. */
async function claim(msg: Outgoing, to: string): Promise<{ id: string; attempt: number } | "already sent"> {
  const db = adminDb();
  const row = {
    hackathon_id: msg.hackathonId,
    kind: msg.kind,
    dedupe_key: msg.dedupeKey,
    to_email: to,
    subject: msg.subject.slice(0, 300),
    phase_id: msg.phaseId ?? null,
    judge_id: msg.judgeId ?? null,
    project_id: msg.projectId ?? null,
  };
  const inserted = await db.from("email_sends").insert(row).select("id").single<{ id: string }>();
  if (!inserted.error) return { id: inserted.data.id, attempt: 0 };
  if (inserted.error.code !== "23505") throw new Error(`Couldn't log the email: ${inserted.error.message}`);

  const { data: existing, error } = await db
    .from("email_sends")
    .select("id, status, attempts")
    .eq("hackathon_id", msg.hackathonId)
    .eq("dedupe_key", msg.dedupeKey)
    .single<{ id: string; status: "sending" | "sent" | "failed"; attempts: number }>();
  if (error) throw new Error(`Couldn't read the email log: ${error.message}`);
  if (existing.status === "sent") return "already sent";
  // A "sending" row is a step that died mid-send: same attempt, so Resend's
  // idempotency key catches it if the first try did go out. A failed one is
  // a fresh attempt with a fresh key.
  const attempt = existing.status === "failed" ? existing.attempts + 1 : existing.attempts;
  const { error: updateError } = await db
    .from("email_sends")
    .update({ status: "sending", attempts: attempt, error: null, to_email: to, subject: row.subject })
    .eq("id", existing.id);
  if (updateError) throw new Error(`Couldn't update the email log: ${updateError.message}`);
  return { id: existing.id, attempt };
}

async function settle(id: string, update: { status: "sent" | "failed"; provider_id?: string; error?: string }) {
  const { error } = await adminDb()
    .from("email_sends")
    .update({ ...update, error: update.error?.slice(0, 2000) ?? null, sent_at: update.status === "sent" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Couldn't update the email log: ${error.message}`);
}

/** Send one email, at most once per dedupe key. Throws RetryableError when Resend asks to try later. */
export async function deliver(msg: Outgoing): Promise<Delivery> {
  const config = emailConfig();
  if ("missing" in config) throw new FatalError(`Email isn't set up on this server: ${config.missing}.`);
  const to = msg.to.trim().toLowerCase();
  if (!to) return "skipped";

  const claimed = await claim(msg, to);
  if (claimed === "already sent") return claimed;
  if (isReservedAddress(to)) {
    await settle(claimed.id, { status: "failed", error: `${to} is a reserved example address, so it was skipped.` });
    return "failed";
  }

  const html = await render(msg.element);
  const redirect = config.redirectTo;
  const { data, error } = await new Resend(config.apiKey).emails.send(
    {
      from: sender(msg.fromName, config.fromAddress),
      to: redirect ?? to,
      subject: redirect ? `[to ${to}] ${msg.subject}` : msg.subject,
      html,
      text: toPlainText(html),
      replyTo: msg.replyTo || undefined,
      tags: [{ name: "kind", value: msg.kind }],
    },
    { idempotencyKey: `${claimed.id}:${claimed.attempt}` },
  );

  if (data) {
    await settle(claimed.id, { status: "sent", provider_id: data.id });
    return "sent";
  }
  await settle(claimed.id, { status: "failed", error: error?.message ?? "Resend didn't accept the email." });
  if (!error || RETRYABLE.has(error.name) || (error.statusCode ?? 500) >= 500) {
    throw new RetryableError(`Resend: ${error?.message ?? "no response"}`, { retryAfter: "5s" });
  }
  return "failed";
}

/** Resend's default limit is a few requests a second; space out a run of sends. */
export const pace = () => new Promise((resolve) => setTimeout(resolve, 600));
