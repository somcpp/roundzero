// Settings for outgoing email, from the environment:
//   RESEND             Resend API key.
//   FROM_EMAIL         A sender address on a domain verified in Resend. Each
//                      hackathon sends as "<its sender name> <FROM_EMAIL>".
//   APP_URL            Origin for links in emails (judge pages, the winners
//                      page). Emails are sent from background runs with no
//                      request to read it from.
//   EMAIL_REDIRECT_TO  Development: send every email here instead, with the
//                      real recipient in the subject. Unset to send for real.

export type EmailConfig = { apiKey: string; fromAddress: string; redirectTo: string | null };

/** The bare address in FROM_EMAIL, which may be written "Name <a@b.com>". */
const bareAddress = (value: string) => value.match(/<([^>]+)>/)?.[1]?.trim() ?? value.trim();

/** The email settings, or why email can't go out on this server. */
export function emailConfig(): EmailConfig | { missing: string } {
  const apiKey = process.env.RESEND ?? process.env.RESEND_API_KEY;
  if (!apiKey) return { missing: "RESEND isn't set" };
  const fromAddress = bareAddress(process.env.FROM_EMAIL ?? "");
  if (!fromAddress.includes("@")) return { missing: "FROM_EMAIL isn't set" };
  return { apiKey, fromAddress, redirectTo: process.env.EMAIL_REDIRECT_TO?.trim() || null };
}

/** "Name <address>", with characters that would break the header taken out of the name. */
export function sender(name: string, address: string) {
  const clean = name.replace(/[<>"\r\n]/g, "").trim().slice(0, 80);
  return clean ? `"${clean}" <${address}>` : address;
}

/** The app's origin, e.g. "https://roundzero.dev", for absolute links in emails. */
export function appUrl() {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Reserved example domains (RFC 2606/6761) never receive mail. Sending to
 * them only bounces, which hurts the sender's reputation, so they're skipped.
 */
export function isReservedAddress(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return (
    /^example\.(com|net|org)$/.test(domain) ||
    /\.(example|test|invalid|localhost)$/.test(domain) ||
    ["example", "test", "invalid", "localhost"].includes(domain)
  );
}
