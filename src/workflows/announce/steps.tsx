import ThankYouEmail, { thankYouSubject, type ThankYouEmailProps } from "@/emails/thank-you";
import WinnerEmail, { winnerSubject, type WinnerEmailProps } from "@/emails/winner";
import { deliver, pace } from "@/lib/email/deliver";

// The one step behind ./index.ts: send a slice of the announcement. Recipients
// and copy were snapshotted by the owner's click (src/lib/email/announce.ts),
// so edits made while it runs don't change what goes out mid-way.

type Common = { hackathonId: string; fromName: string; replyTo: string | null };

export type WinnerRecipient = Pick<WinnerEmailProps, "projectName" | "rank" | "tiers"> & { projectId: string; to: string };
export type ThankYouRecipient = Pick<ThankYouEmailProps, "project"> & { projectId: string; to: string };

export type Announcement = Common &
  (
    | { kind: "winner"; shared: Omit<WinnerEmailProps, "projectName" | "rank" | "tiers">; recipients: WinnerRecipient[] }
    | { kind: "thank_you"; shared: Omit<ThankYouEmailProps, "project">; recipients: ThankYouRecipient[] }
  );

export type AnnounceTally = { sent: number; skipped: number; failed: number };

/** Send recipients [from, to) of the announcement. Anyone already emailed is skipped. */
export async function sendSlice(a: Announcement, from: number, to: number): Promise<AnnounceTally> {
  "use step";
  const tally: AnnounceTally = { sent: 0, skipped: 0, failed: 0 };
  for (let i = from; i < Math.min(to, a.recipients.length); i++) {
    const common = { hackathonId: a.hackathonId, fromName: a.fromName, replyTo: a.replyTo, kind: a.kind };
    let result;
    if (a.kind === "winner") {
      const r = a.recipients[i];
      result = await deliver({
        ...common,
        dedupeKey: `winner:${r.projectId}`,
        to: r.to,
        projectId: r.projectId,
        subject: winnerSubject(a.shared.hackathon, r.tiers),
        element: <WinnerEmail {...a.shared} projectName={r.projectName} rank={r.rank} tiers={r.tiers} />,
      });
    } else {
      const r = a.recipients[i];
      result = await deliver({
        ...common,
        dedupeKey: `thank_you:${r.projectId}`,
        to: r.to,
        projectId: r.projectId,
        subject: thankYouSubject(a.shared.email, a.shared.hackathon, r.project.name),
        element: <ThankYouEmail {...a.shared} project={r.project} />,
      });
    }
    if (result === "sent") {
      tally.sent++;
      await pace();
    } else if (result === "failed") tally.failed++;
    else tally.skipped++;
  }
  return tally;
}
