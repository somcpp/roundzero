import type { BlockType, SchemaBlock } from "@/lib/data";
import { valueShape } from "@/lib/project-fields";

// The public contract of the project intake API (src/app/api/intake/route.ts):
// field keys, examples and the copy-paste agent prompt. Pure, so the admin
// drawer and the endpoint build the same docs from the same schema.

/** Prefix on API keys, so the endpoint (and people) can tell one on sight. */
export const API_KEY_PREFIX = "rk_";
/** Most projects in one API request. */
export const MAX_BATCH = 100;
/** Largest request body the endpoint reads. */
export const MAX_BODY_BYTES = 1_000_000;

/**
 * Rate limits, per fixed window. `ip` covers every intake request; `api` is
 * per key; `formIp` and `form` are per submitter and per form.
 */
export const LIMITS = {
  ip: { limit: 60, seconds: 60 },
  api: { limit: 30, seconds: 60 },
  formIp: { limit: 5, seconds: 600 },
  form: { limit: 300, seconds: 600 },
} as const;

/**
 * Every project's fixed contact field, outside the schema: where the team
 * hears about results (winner and thank-you emails go here).
 */
export const CONTACT_FIELD = {
  key: "contact_email",
  title: "Contact email",
  description: "Where the team hears about results. Winner and thank-you emails go here.",
} as const;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A contact email as stored: trimmed and lowercased, "" when none was given. */
export function normalizeContactEmail(value: unknown): { email: string } | { error: string } {
  if (value === undefined || value === null) return { email: "" };
  if (typeof value !== "string") return { error: `"${CONTACT_FIELD.key}" must be a string.` };
  const email = value.trim().toLowerCase();
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: `"${email}" isn't a valid contact email.` };
  return { email };
}

export type IntakeField = {
  key: string;
  blockId: string;
  title: string;
  type: BlockType;
  /** How to send it: a string, a number, or an array of strings. */
  shape: "string" | "number" | "string[]";
  description: string;
  expected: string;
};

/** "GitHub repo" → "github_repo". */
function slugKey(title: string) {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

/**
 * The schema as API fields. Keys come from block titles in form order, with
 * _2, _3… on repeats, so renaming a block renames its key.
 */
export function intakeFields(blocks: SchemaBlock[]): IntakeField[] {
  const seen = new Map<string, number>();
  return blocks.map((b) => {
    const base = slugKey(b.title);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const shape = valueShape(b.type);
    return {
      key: n === 1 ? base : `${base}_${n}`,
      blockId: b.id,
      title: b.title,
      type: b.type,
      shape: shape === "list" ? "string[]" : shape,
      description: b.description,
      expected: b.expected,
    };
  });
}

const EXAMPLES: Record<BlockType, unknown> = {
  text: "Repo Whisperer",
  "long text": "What it does, how it was built and what comes next.",
  number: 3,
  url: "https://example.com",
  "video url": "https://youtube.com/watch?v=…",
  "repo url": "https://github.com/team/project",
  file: ["https://example.com/deck.pdf"],
  select: "Option",
  image: ["https://example.com/screenshot.png"],
  team: ["Ada Lovelace", "Alan Turing"],
};

/** One example project, keyed like the API expects. The first text field is the name. */
export function exampleProject(fields: IntakeField[]) {
  const name = fields.find((f) => f.type === "text");
  return {
    ...Object.fromEntries(fields.map((f) => [f.key, f.type === "text" && f !== name ? "A short answer" : EXAMPLES[f.type]])),
    [CONTACT_FIELD.key]: "team@example.com",
  };
}

export function curlExample(endpoint: string, key: string, fields: IntakeField[]) {
  const body = JSON.stringify({ projects: [exampleProject(fields)] }, null, 2);
  return [
    `curl -X POST ${endpoint} \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${body.replace(/'/g, "'\\''")}'`,
  ].join("\n");
}

/**
 * Instructions to paste into a local coding agent so it can import projects
 * from whatever the admin has (a spreadsheet, a CSV, another tool's export).
 */
export function agentPrompt({
  hackathon,
  endpoint,
  key,
  fields,
}: {
  hackathon: string;
  endpoint: string;
  /** The key itself, or a placeholder like $ROUNDZERO_API_KEY. */
  key: string;
  fields: IntakeField[];
}) {
  const rows = fields.map((f) => {
    const notes = [f.description, f.expected && `Expected: ${f.expected}`].filter(Boolean).join(" ");
    return `| \`${f.key}\` | ${f.shape} | ${f.title}${notes ? ` — ${notes.replace(/\|/g, "/")}` : ""} |`;
  });
  return `Import projects into the "${hackathon}" hackathon using its intake API.

## Endpoint

- Create projects: \`POST ${endpoint}\`
- Read the current schema: \`GET ${endpoint}\`
- Auth header on both: \`Authorization: Bearer ${key}\`
- Body: JSON, \`{ "projects": [ {…}, {…} ] }\`, at most ${MAX_BATCH} projects per request.

## Fields

Every field is optional, but send the first one (the project's name) and \`${CONTACT_FIELD.key}\` when you can. Unknown keys are rejected.

| Key | Type | Meaning |
| --- | --- | --- |
${rows.join("\n")}
| \`${CONTACT_FIELD.key}\` | string | ${CONTACT_FIELD.title} — ${CONTACT_FIELD.description} |

- \`string[]\` fields take a JSON array of strings (image and file fields take public links, not uploads).
- Links without \`https://\` get it added.
- Leave a field out rather than sending an empty string.

Example project:

\`\`\`json
${JSON.stringify(exampleProject(fields), null, 2)}
\`\`\`

## Responses

- \`201\` → \`{ "created": [{ "number": 12, "id": "…" }] }\`, in the order sent.
- \`422\` → \`{ "error": "…", "errors": [{ "index": 0, "error": "…" }] }\`. Nothing in that request was saved: fix the rows listed and resend the whole batch.
- \`429\` → rate limited (${LIMITS.api.limit} requests a minute per key). Wait for the \`Retry-After\` seconds, then retry.
- \`401\` → the key is wrong or the API was switched off.

## How to do the import

1. Open the source I point you at (spreadsheet, CSV, JSON, another tool's export) and list its columns.
2. Propose a mapping from source columns to the keys above, and show me 2–3 converted rows. Wait for my OK before sending anything.
3. Split multi-value cells (team members, image links) into arrays. Skip empty or duplicate rows.
4. Send in batches of up to ${MAX_BATCH}. Don't resend a batch that returned \`201\`: that would create duplicates.
5. Tell me how many projects were created and their numbers, and list any rows you skipped and why.
`;
}
