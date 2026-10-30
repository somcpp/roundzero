// Demo mode. With DEMO_MODE=true, the sign-in form comes filled in with a
// shared demo login, so anyone can look around. The demo account
// (app_metadata.demo, created by scripts/seed-demo.mjs) sees just the
// hackathons flagged `demo`, and nothing it does is saved: it can change
// things on screen, but the app turns off every control that saves, and the
// database refuses its writes anyway (migrations/*_demo_accounts.sql).

/** Whether the sign-in page offers the demo login. Server-only. */
export const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * The shared demo login. Public on purpose: it's shown on the sign-in page,
 * and the account can't change anything. The seed script reads the same
 * variables, with the same defaults, when it creates the account.
 */
export const DEMO_LOGIN = {
  email: (process.env.DEMO_EMAIL || "demo@roundzero.dev").toLowerCase(),
  password: process.env.DEMO_PASSWORD || "try-roundzero-demo",
};

/** Why a control is off for the demo account. */
export const DEMO_READ_ONLY = "This is a demo, so changes aren't saved. Self-host RoundZero to run your own.";
