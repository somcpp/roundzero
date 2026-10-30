import type { Hackathon } from "@/lib/data";
import { appUrl } from "@/lib/email/config";
import { loadEmailContext } from "@/lib/email/context";
import { getJudgingActivity, listPhases, listProjects } from "@/lib/judging";
import { projectHeadline } from "@/lib/project-fields";
import { getResults, type Results } from "@/lib/results";
import { getRewardEmail } from "@/lib/reward-emails";
import { rewardImageUrl } from "@/lib/reward-images";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";
import { getThankYouEmail } from "@/lib/thank-you-emails";
import type { Announcement, ThankYouRecipient, WinnerRecipient } from "@/workflows/announce/steps";

// Who the results emails go to, read as the signed-in owner. "Email winners"
// and "Email everyone else" snapshot this into src/workflows/announce; the
// Results page shows the same numbers before anything is sent.

export type AnnounceKind = "winner" | "thank_you";

export type AnnounceAudience = {
  kind: AnnounceKind;
  /** Projects this email is for: every winner, or everyone else who wasn't disqualified. */
  total: number;
  sent: number;
  failed: number;
  /** Queued or going out right now. */
  sending: number;
  /** Projects with no contact email, so they can't be sent this. */
  noEmail: { number: number; name: string }[];
  /** Still to send: has an email and hasn't been sent it. */
  ready: number;
};

export type AnnounceStatus = {
  /** The last phase has closed, so the ranking is final. */
  final: boolean;
  published: boolean;
  /** False when the thank-you email is switched off in its settings. */
  thankYouEnabled: boolean;
  winners: AnnounceAudience;
  everyoneElse: AnnounceAudience;
};

type Loaded = Awaited<ReturnType<typeof load>>;

async function load(hackathon: Hackathon, known?: Results) {
  const supabase = await createClient();
  const [results, projects, blocks, phases, activity, contacts, sends] = await Promise.all([
    known ?? getResults(hackathon),
    listProjects(hackathon.id),
    listSchemaBlocks(hackathon.id),
    listPhases(hackathon.id),
    getJudgingActivity(hackathon.id),
    supabase.from("projects").select("id, contact_email").eq("hackathon_id", hackathon.id),
    supabase.from("email_sends").select("project_id, kind, status").eq("hackathon_id", hackathon.id).in("kind", ["winner", "thank_you"]),
  ]);
  if (contacts.error) throw new Error(`Couldn't load contact emails: ${contacts.error.message}`);
  if (sends.error) throw new Error(`Couldn't load sent emails: ${sends.error.message}`);
  const email = new Map(contacts.data.map((p) => [p.id as string, (p.contact_email as string) ?? ""]));
  const status = new Map(sends.data.map((s) => [`${s.kind}:${s.project_id}`, s.status as "sending" | "sent" | "failed"]));
  const winnerIds = new Set(results.winners.map((w) => w.project.id));
  const others = projects.filter((p) => !winnerIds.has(p.id) && p.status !== "disqualified");
  return { results, projects, blocks, phases, activity, email, status, others };
}

function audience(
  kind: AnnounceKind,
  projects: { id: string; number: number; name: string }[],
  { email, status }: Pick<Loaded, "email" | "status">,
): AnnounceAudience {
  const count = (s: string) => projects.filter((p) => status.get(`${kind}:${p.id}`) === s).length;
  const noEmail = projects.filter((p) => !email.get(p.id));
  return {
    kind,
    total: projects.length,
    sent: count("sent"),
    failed: count("failed"),
    sending: count("sending"),
    noEmail: noEmail.map((p) => ({ number: p.number, name: p.name })),
    ready: projects.filter((p) => email.get(p.id) && status.get(`${kind}:${p.id}`) !== "sent").length,
  };
}

const named = (l: Loaded) => (p: Loaded["projects"][number]) => ({ id: p.id, number: p.number, name: projectHeadline(p, l.blocks).name });

/** How many winners and everyone-else emails are sent, waiting, or missing an address. Pass `results` if you have them. */
export async function getAnnounceStatus(hackathon: Hackathon, results?: Results): Promise<AnnounceStatus> {
  const [l, thankYou] = await Promise.all([load(hackathon, results), getThankYouEmail(hackathon.id)]);
  return {
    final: l.results.state === "final",
    published: !!hackathon.published,
    thankYouEnabled: thankYou.enabled,
    winners: audience("winner", l.results.winners.map((w) => w.project), l),
    everyoneElse: audience("thank_you", l.others.map(named(l)), l),
  };
}

/**
 * The announcement to send: every recipient with a contact email who hasn't
 * been sent it yet, with the copy as it is now. No recipients means
 * there's nobody left to send to.
 */
export async function buildAnnouncement(hackathon: Hackathon, kind: AnnounceKind): Promise<Announcement | { error: string }> {
  const [l, ctx] = await Promise.all([load(hackathon), loadEmailContext(hackathon.id)]);
  if (!ctx) return { error: "Hackathon not found." };
  if (l.results.state !== "final") return { error: "Close the last judging phase first, so the ranking is final." };
  const due = (id: string) => !!l.email.get(id) && l.status.get(`${kind}:${id}`) !== "sent";
  const winnersUrl = `${appUrl()}/w/${hackathon.slug}`;
  const common = { hackathonId: hackathon.id, replyTo: ctx.ownerInbox };

  if (kind === "winner") {
    const email = await getRewardEmail(hackathon.id);
    const recipients: WinnerRecipient[] = l.results.winners
      .filter((w) => due(w.project.id))
      .map((w) => ({
        projectId: w.project.id,
        to: l.email.get(w.project.id)!,
        projectName: w.project.name,
        rank: w.rank,
        tiers: w.tiers.map((t) => ({ id: t.id, name: t.name, description: t.description, items: t.items, imageUrl: rewardImageUrl(t.imagePath) })),
      }));
    return {
      ...common,
      kind,
      fromName: email.fromName || hackathon.name,
      shared: { hackathon: ctx.hackathon, email, total: l.results.ranking.length, winnersUrl },
      recipients,
    };
  }

  const email = await getThankYouEmail(hackathon.id);
  if (!email.enabled) return { error: "The thank-you email is switched off. Turn it on in Judging › Rewards › Thank-you email." };
  const submitted = l.activity.assignments.filter((a) => a.submittedAt && a.judgeId);
  const reviews = new Map<string, number>();
  for (const a of submitted) reviews.set(a.projectId, (reviews.get(a.projectId) ?? 0) + 1);
  const recipients: ThankYouRecipient[] = l.others
    .filter((p) => due(p.id))
    .map((p) => {
      const round = l.phases.findIndex((ph) => ph.id === p.phaseId);
      return {
        projectId: p.id,
        to: l.email.get(p.id)!,
        project: {
          name: projectHeadline(p, l.blocks).name,
          reviews: reviews.get(p.id) ?? 0,
          milestone: round >= 0 && l.phases.length > 1 ? `Reached round ${round + 1} of ${l.phases.length}` : null,
        },
      };
    });
  return {
    ...common,
    kind,
    fromName: email.fromName || hackathon.name,
    shared: {
      hackathon: ctx.hackathon,
      email,
      stats: {
        projects: l.projects.filter((p) => p.status !== "disqualified").length,
        judges: new Set(submitted.map((a) => a.judgeId)).size,
        reviews: submitted.length,
      },
      winners: l.results.winners.map((w) => ({
        id: w.project.id,
        name: w.project.name,
        pitch: w.project.pitch,
        rank: w.rank,
        prize: w.tiers.map((t) => t.name).join(" + "),
      })),
      winnersUrl,
    },
    recipients,
  };
}
