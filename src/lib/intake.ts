import { createHash } from "node:crypto";
import type { ProjectValue, SchemaBlock, Stage } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Server side of project intake (supabase/migrations/*_project_intake.sql).
// Settings are read as the signed-in owner; everything a caller without a
// session does goes through the admin client and the intake_* functions.

export type IntakeKind = "api" | "form";

export type IntakeSettings = {
  apiEnabled: boolean;
  /** Last characters of the live key, e.g. "…x7Qa". */
  apiKeyHint: string | null;
  apiKeyCreatedAt: string | null;
  formEnabled: boolean;
  formToken: string | null;
  /** False when SUPABASE_SECRET_KEY is missing, so nothing from outside can get in yet. */
  configured: boolean;
};

/** A hackathon's intake settings. RLS limits it to the owner. */
export async function getIntakeSettings(hackathonId: string): Promise<IntakeSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_settings")
    .select("api_enabled, api_key_hint, api_key_created_at, form_enabled, form_token")
    .eq("hackathon_id", hackathonId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load intake settings: ${error.message}`);
  return {
    apiEnabled: data?.api_enabled ?? false,
    apiKeyHint: data?.api_key_hint ?? null,
    apiKeyCreatedAt: data?.api_key_created_at ?? null,
    formEnabled: data?.form_enabled ?? false,
    formToken: data?.form_token ?? null,
    configured: !!(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** What a credential stored in the database looks like: the key's hash, or the form token as is. */
const stored = (kind: IntakeKind, credential: string) => (kind === "api" ? hashKey(credential) : credential);

export type IntakeTarget = {
  hackathon: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    color: string;
    logo: string | null;
    logo_path: string | null;
    /** Missing until migrations/*_hackathon_banners.sql is applied. */
    banner_path?: string | null;
    stage: Stage;
  };
  blocks: SchemaBlock[];
};

export class IntakeUnavailableError extends Error {
  constructor(reason = "SUPABASE_SECRET_KEY is missing") {
    super(`Intake isn't set up on this server yet: ${reason}.`);
  }
}

/** Supabase answers 401 when the key itself is wrong (a placeholder, or another project's). */
function checkKey(status: number) {
  if (status === 401) throw new IntakeUnavailableError("Supabase rejected SUPABASE_SECRET_KEY");
}

function admin() {
  const client = createAdminClient();
  if (!client) throw new IntakeUnavailableError();
  return client;
}

/** The hackathon and schema a credential opens, or null if it's wrong or switched off. */
export async function getIntakeTarget(kind: IntakeKind, credential: string): Promise<IntakeTarget | null> {
  const { data, error, status } = await admin().rpc("intake_target", {
    p_kind: kind,
    p_credential: stored(kind, credential),
  });
  checkKey(status);
  if (error) throw new Error(`Couldn't look up intake: ${error.message}`);
  return (data as IntakeTarget | null) ?? null;
}

export type Limit = { bucket: string; limit: number; seconds: number };

/**
 * Count this request against each limit. Returns the seconds until the
 * window that's full resets, or null if the request may go ahead.
 */
export async function checkRateLimits(limits: Limit[]): Promise<number | null> {
  const { data, error, status } = await admin().rpc("intake_rate_limit", { p_limits: limits });
  checkKey(status);
  if (error) throw new Error(`Couldn't check rate limits: ${error.message}`);
  if (!data) return null;
  const hit = limits.find((l) => l.bucket === data)!;
  return hit.seconds - (Math.floor(Date.now() / 1000) % hit.seconds);
}

/** A short, stable, non-reversible bucket name for a credential. */
export const bucketFor = (kind: IntakeKind, credential: string) =>
  `${kind}:${hashKey(credential).slice(0, 24)}`;

/** Create projects from normalized values, all or nothing. Returns them in order. */
export async function submitIntake(
  kind: IntakeKind,
  credential: string,
  projects: { values: Record<string, ProjectValue>; contact_email: string }[],
): Promise<{ id: string; number: number }[]> {
  const { data, error, status } = await admin().rpc("intake_submit", {
    p_kind: kind,
    p_credential: stored(kind, credential),
    p_projects: projects,
  });
  checkKey(status);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data as { id: string; number: number }[];
}

/** The caller's IP as the host's proxy reports it. */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || headers.get("x-real-ip") || "unknown").slice(0, 64);
}
