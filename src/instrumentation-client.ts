import posthog from "posthog-js";

// Runs in the browser before the app hydrates, on every page (landing, docs,
// app). The '2026-05-30' defaults capture pageviews on client-side navigation
// too, not just full loads. Skipped when the key is unset (e.g. local dev
// without PostHog configured).
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** Every event carries this, so filtering on product = round-zero finds them all. */
const PRODUCT = "round-zero";

/**
 * Which part of RoundZero the event came from. The landing page is "/" for
 * signed-out visitors on the site hosts (the proxy rewrites it to /landing),
 * so it's told apart by its .landing wrapper rather than the URL.
 */
function surface(): string {
  const path = location.pathname;
  if (path === "/landing" || document.querySelector(".landing")) return "site";
  if (path === "/docs" || path.startsWith("/docs/")) return "docs";
  if (path.startsWith("/j/")) return "judge-portal";
  if (path.startsWith("/f/")) return "submission-form";
  if (path.startsWith("/w/")) return "winners-page";
  if (path === "/login" || path === "/signup") return "auth";
  return "app";
}

if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    defaults: "2026-05-30",
    before_send: (event) => {
      if (event) event.properties = { ...event.properties, product: PRODUCT, surface: surface() };
      return event;
    },
  });
}
