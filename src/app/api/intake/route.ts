import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ProjectValue } from "@/lib/data";
import {
  IntakeUnavailableError,
  bucketFor,
  checkRateLimits,
  clientIp,
  getIntakeTarget,
  submitIntake,
  type IntakeKind,
  type IntakeTarget,
  type Limit,
} from "@/lib/intake";
import {
  API_KEY_PREFIX,
  CONTACT_FIELD,
  LIMITS,
  MAX_BATCH,
  MAX_BODY_BYTES,
  intakeFields,
  normalizeContactEmail,
} from "@/lib/intake-shape";
import { normalizeValues, projectHeadline } from "@/lib/project-fields";
import { indexProjects } from "@/lib/project-index";
import { createAdminClient } from "@/lib/supabase/admin";

// Project intake. One endpoint, two ways in:
//   • API: `Authorization: Bearer rk_…`, body { projects: [{ <field key>: value }] }.
//     GET returns the schema. Docs: src/lib/intake-shape.ts (agentPrompt).
//   • Submission form (/f/<token>): body { form: <token>, values: { <block id>: value }, contactEmail }.
// Besides the schema, every project has a fixed contact email ("contact_email"
// in the API), where winner and thank-you emails go.
// Both are rate limited per IP and per credential, and all-or-nothing.

type Fail = { status: number; error: string; errors?: { index: number; error: string }[]; retryAfter?: number };

const fail = ({ status, error, errors, retryAfter }: Fail) =>
  Response.json(
    { error, ...(errors && { errors }) },
    { status, headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined },
  );

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The API key from `Authorization: Bearer …`, or null when there's no header. */
function bearer(req: Request): string | null | Fail {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const key = header.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key?.startsWith(API_KEY_PREFIX) || key.length > 100) {
    return { status: 401, error: `Send your API key as "Authorization: Bearer ${API_KEY_PREFIX}…".` };
  }
  return key;
}

/** Rate-limit, then resolve the credential to its hackathon. */
async function open(req: Request, kind: IntakeKind, credential: string): Promise<IntakeTarget | Fail> {
  const ip = clientIp(req.headers);
  const limits: Limit[] = [{ bucket: `ip:${ip}`, ...LIMITS.ip }];
  if (kind === "api") limits.push({ bucket: bucketFor("api", credential), ...LIMITS.api });
  else {
    limits.push({ bucket: `${bucketFor("form", credential)}:${ip}`, ...LIMITS.formIp });
    limits.push({ bucket: bucketFor("form", credential), ...LIMITS.form });
  }
  const retryAfter = await checkRateLimits(limits);
  if (retryAfter !== null) {
    return { status: 429, error: `Too many requests. Try again in ${retryAfter} seconds.`, retryAfter };
  }
  const target = await getIntakeTarget(kind, credential);
  if (target) return target;
  return kind === "api"
    ? { status: 401, error: "That API key is wrong, or the API has been switched off." }
    : { status: 404, error: "This submission form is closed." };
}

/** Map one API project ({ field key or block id: value }) to block ids. The contact email isn't a block; it's left out. */
function byBlockId(
  project: Record<string, unknown>,
  target: IntakeTarget,
): { values: Record<string, unknown> } | { error: string } {
  const fields = intakeFields(target.blocks);
  const ids = new Map<string, string>();
  for (const f of fields) {
    ids.set(f.key, f.blockId);
    ids.set(f.blockId, f.blockId);
  }
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(project)) {
    if (k === CONTACT_FIELD.key) continue;
    const id = ids.get(k);
    if (!id) return { error: `Unknown field "${k}". Fields: ${[...fields.map((f) => f.key), CONTACT_FIELD.key].join(", ")}.` };
    values[id] = v;
  }
  return { values };
}

async function handle(req: Request, run: () => Promise<Response>) {
  try {
    return await run();
  } catch (e) {
    if (e instanceof IntakeUnavailableError) return fail({ status: 503, error: e.message });
    console.error("[intake]", e instanceof Error ? e.message : e);
    return fail({ status: 500, error: "Something went wrong on our side. Try again in a moment." });
  }
}

/** The schema an API key writes to. */
export async function GET(req: Request) {
  return handle(req, async () => {
    const key = bearer(req);
    if (key === null) return fail({ status: 401, error: "Missing API key." });
    if (typeof key !== "string") return fail(key);
    const target = await open(req, "api", key);
    if ("status" in target) return fail(target);
    return Response.json({
      hackathon: { name: target.hackathon.name, slug: target.hackathon.slug },
      fields: intakeFields(target.blocks).map(({ key, title, shape, type, description, expected }) => ({
        key,
        title,
        shape,
        type,
        description,
        expected,
      })),
      contact: { key: CONTACT_FIELD.key, title: CONTACT_FIELD.title, shape: "string", description: CONTACT_FIELD.description },
      maxBatch: MAX_BATCH,
    });
  });
}

export async function POST(req: Request) {
  return handle(req, async () => {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return fail({ status: 413, error: "Request body is too large. Send fewer projects at a time." });
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail({ status: 413, error: "Request body is too large. Send fewer projects at a time." });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail({ status: 400, error: "Body must be JSON." });
    }
    if (!isRecord(body)) return fail({ status: 400, error: "Body must be a JSON object." });

    const key = bearer(req);
    if (key !== null && typeof key !== "string") return fail(key);
    const kind: IntakeKind = key ? "api" : "form";
    const credential = key ?? (typeof body.form === "string" ? body.form : "");
    if (!credential || credential.length > 100) return fail({ status: 401, error: "Missing API key." });

    const target = await open(req, kind, credential);
    if ("status" in target) return fail(target);

    // Raw projects, keyed by block id, and each one's contact email as sent.
    let projects: Record<string, unknown>[];
    let contacts: unknown[];
    if (kind === "form") {
      // Honeypot: people never see this field, so anything in it is a bot. Look successful.
      if (typeof body.website === "string" && body.website.trim()) return Response.json({ created: [] }, { status: 201 });
      if (!isRecord(body.values)) return fail({ status: 400, error: "Missing form values." });
      projects = [body.values];
      contacts = [body.contactEmail];
    } else {
      const list = "projects" in body ? body.projects : [body];
      if (!Array.isArray(list) || !list.length) return fail({ status: 400, error: `"projects" must be a non-empty array.` });
      if (list.length > MAX_BATCH) return fail({ status: 413, error: `Send at most ${MAX_BATCH} projects per request.` });
      contacts = list.map((p) => (isRecord(p) ? p[CONTACT_FIELD.key] : undefined));
      const errors: { index: number; error: string }[] = [];
      projects = list.map((p, index) => {
        if (!isRecord(p)) {
          errors.push({ index, error: "Each project must be a JSON object." });
          return {};
        }
        const mapped = byBlockId(p, target);
        if ("error" in mapped) errors.push({ index, error: mapped.error });
        return "values" in mapped ? mapped.values : {};
      });
      if (errors.length) return fail({ status: 422, error: "Some projects are invalid. Nothing was saved.", errors });
    }

    const errors: { index: number; error: string }[] = [];
    const { nameBlockId } = projectHeadline({ number: 0, values: {} }, target.blocks);
    const clean: { values: Record<string, ProjectValue>; contact_email: string }[] = [];
    projects.forEach((p, index) => {
      const result = normalizeValues(target.blocks, p);
      if ("error" in result) return errors.push({ index, error: result.error });
      const contact = normalizeContactEmail(contacts[index]);
      if ("error" in contact) return errors.push({ index, error: contact.error });
      if (Object.keys(result.values).length === 0) return errors.push({ index, error: "Fill in at least one field." });
      // The form always asks for a name, so projects don't arrive as "Project #012".
      if (kind === "form" && nameBlockId && !(nameBlockId in result.values)) {
        const name = target.blocks.find((b) => b.id === nameBlockId)!.title;
        return errors.push({ index, error: `"${name}" is required.` });
      }
      // …and where to send the results.
      if (kind === "form" && !contact.email) return errors.push({ index, error: `"${CONTACT_FIELD.title}" is required.` });
      clean.push({ values: result.values, contact_email: contact.email });
    });
    if (errors.length) {
      return kind === "form"
        ? fail({ status: 422, error: errors[0].error })
        : fail({ status: 422, error: "Some projects are invalid. Nothing was saved.", errors });
    }

    try {
      const created = await submitIntake(kind, credential, clean);
      revalidatePath(`/h/${target.hackathon.slug}`, "layout");
      // Embed for the chat's project search once the response is sent. The
      // caller is anonymous, so this runs with the admin client; anything
      // that doesn't finish shows up under "Index" on the chat page.
      const supabase = createAdminClient();
      if (supabase) {
        const ids = created.map((p) => p.id);
        after(() => indexProjects(target.hackathon.id, ids, { blocks: target.blocks, supabase }));
      }
      return Response.json({ created }, { status: 201 });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "23505") return fail({ status: 409, error: "Another project was added at the same moment. Try again." });
      if (code === "P0002") return fail({ status: kind === "api" ? 401 : 404, error: "Intake was just switched off." });
      throw e;
    }
  });
}
