// The marketing landing page belongs to the official RoundZero deployment only.
// On these hosts, "/" shows it to signed-out visitors; everywhere else
// (self-hosted instances, preview deploys) "/" stays the sign-in screen or
// the dashboard. Override with SITE_HOSTS="a.com,www.a.com", or set it to ""
// to turn the landing page off.
const DEFAULT_SITE_HOSTS = ["roundzero.dev", "www.roundzero.dev"];

const siteHosts = (process.env.SITE_HOSTS?.split(",") ?? DEFAULT_SITE_HOSTS)
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** Whether a request's Host header is one that serves the landing page. */
export function isSiteHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").toLowerCase();
  // Browsers resolve *.localhost to this machine, so roundzero.localhost:3001
  // previews the site in development.
  if (process.env.NODE_ENV !== "production" && name === "roundzero.localhost") return true;
  return siteHosts.includes(name);
}
