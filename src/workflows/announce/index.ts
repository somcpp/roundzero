import { sendSlice, type AnnounceTally, type Announcement } from "./steps";

// Results emails, started from the Results page (src/lib/email-actions.ts):
// "Email winners" sends each winning project its prizes, "Email everyone else"
// sends the thank-you. Ten per step, so a retry only redoes a few, and every
// send is keyed per project, so pressing the button twice never doubles up.

const SLICE = 10;

export async function announceResults(a: Announcement) {
  "use workflow";
  const total: AnnounceTally = { sent: 0, skipped: 0, failed: 0 };
  for (let from = 0; from < a.recipients.length; from += SLICE) {
    const t = await sendSlice(a, from, from + SLICE);
    total.sent += t.sent;
    total.skipped += t.skipped;
    total.failed += t.failed;
  }
  return total;
}
