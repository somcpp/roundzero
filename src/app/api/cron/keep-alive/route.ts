import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { brand } from "@/lib/branding";
import { appUrl, emailConfig, sender } from "@/lib/email/config";

// Keeps the Supabase project awake. Supabase pauses a Free-plan project after
// a week without database activity, and a paused project answers every request
// with HTTP 540 until someone restores it from the dashboard. vercel.json calls
// this once a day. Each run reads from the database, Auth and Storage. If
// they still fail after a couple of retries, it emails ALERT_EMAIL through
// Resend. (Vercel Hobby only allows daily crons; use one schedule per run there.)
//
// Vercel sends CRON_SECRET as a bearer token, and when it's set nothing else
// gets in. Without it the route stays open, so a missing secret can't quietly
// stop the pings: a run is a few reads, and alerts go out at most once an hour.

export const maxDuration = 60;

const TIMEOUT_MS = 10_000;
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

type Check = { name: "database" | "auth" | "storage"; ok: boolean; ms: number; status?: number; error?: string };

/** Never cached, and gives up after TIMEOUT_MS so a hung project fails the check instead of the function. */
const fetchFresh: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });

async function timed(name: Check["name"], run: () => Promise<{ status?: number; error?: string | null }>): Promise<Check> {
  const started = Date.now();
  try {
    const { status, error } = await run();
    return { name, ok: !error, ms: Date.now() - started, ...(status ? { status } : {}), ...(error ? { error } : {}) };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

/** One pass over the database, Auth and Storage. */
function checkOnce(url: string, key: string, publishableKey: string): Promise<Check[]> {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchFresh },
  });
  return Promise.all([
    // A real query, since Supabase measures database activity. The client's own
    // retries (1s, 2s, 4s backoff, timeouts included) would outlast maxDuration
    // against a hung project, so check() does the retrying instead.
    timed("database", async () => {
      const { status, error } = await supabase.from("hackathons").select("id").limit(1).retry(false);
      return { status, error: error && (error.message || `HTTP ${status}`) };
    }),
    timed("auth", async () => {
      const res = await fetchFresh(`${url}/auth/v1/health`, { headers: { apikey: publishableKey } });
      return { status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
    }),
    timed("storage", async () => {
      const { error } = await supabase.storage.listBuckets();
      if (!error?.status) return { error: error?.message };
      const { status, message } = error;
      return { status, error: message.includes(String(status)) ? message : `HTTP ${status}: ${message}` };
    }),
  ]);
}

/** Retries failures, so one slow request doesn't send an alert. */
async function check(url: string, key: string, publishableKey: string) {
  let checks = await checkOnce(url, key, publishableKey);
  for (let attempt = 1; attempt < ATTEMPTS && checks.some((c) => !c.ok); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    checks = await checkOnce(url, key, publishableKey);
  }
  return checks;
}

/** Email ALERT_EMAIL about the failed checks. It's for whoever runs the app, so EMAIL_REDIRECT_TO doesn't apply. */
async function sendAlert(url: string, checks: Check[]): Promise<string> {
  const to = process.env.ALERT_EMAIL?.trim();
  if (!to) return "not sent: ALERT_EMAIL isn't set";
  const config = emailConfig();
  if ("missing" in config) return `not sent: ${config.missing}`;

  const { host, hostname } = new URL(url);
  const dashboard = hostname.endsWith(".supabase.co")
    ? `https://supabase.com/dashboard/project/${hostname.split(".")[0]}`
    : "https://supabase.com/dashboard/projects";
  const paused = checks.some((c) => c.status === 540);
  const text = [
    paused
      ? `Supabase has paused the project, so ${brand.name} can't sign anyone in or load hackathons. Restore it from the dashboard; it takes a few minutes, and it's possible for 90 days after the pause:`
      : `The keep-alive check couldn't reach Supabase after ${ATTEMPTS} tries, so ${brand.name} may be down. Check the project:`,
    dashboard,
    "",
    ...checks.filter((c) => !c.ok).map((c) => `- ${c.name}: ${c.error}`),
    "",
    "Supabase status: https://status.supabase.com",
    `Sent by ${appUrl()}/api/cron/keep-alive, which runs once a day.`,
  ].join("\n");

  const { data, error } = await new Resend(config.apiKey).emails.send(
    {
      from: sender(`${brand.name} monitor`, config.fromAddress),
      to,
      subject: paused ? `${brand.name}: Supabase paused the project` : `${brand.name}: Supabase isn't responding`,
      text,
    },
    // Vercel can deliver the same run twice, so the key allows one alert an
    // hour per Supabase project, whichever deployment notices first.
    { idempotencyKey: `keep-alive/${host}/${new Date().toISOString().slice(0, 13)}` },
  );
  if (data) return "sent";
  if (error?.name === "invalid_idempotent_request" || error?.name === "concurrent_idempotent_requests") {
    return "already sent this hour";
  }
  return `failed: ${error?.message ?? "Resend didn't accept it"}`;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return Response.json({ ok: false, error: "The Supabase variables aren't set." }, { status: 500 });
  }
  // The secret key reads past row-level security, so the query returns a real row.
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? publishableKey;

  const checks = await check(url, key, publishableKey);
  if (checks.every((c) => c.ok)) return Response.json({ ok: true, checks });

  const alert = await sendAlert(url, checks).catch((e) => `failed: ${e instanceof Error ? e.message : e}`);
  console.error("[keep-alive] Supabase check failed:", JSON.stringify(checks), "alert:", alert);
  return Response.json({ ok: false, checks, alert }, { status: 503 });
}
