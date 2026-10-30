// App-level branding for the org or team running this RoundZero instance.
// Individual hackathons still set their own color and logo on top of this.

/** @type {import("./src/lib/branding").BrandingConfig} */
const branding = {
  // Product name shown in the header, page titles and the "Judged with" footer.
  name: "RoundZero",

  // Short text badge (1–3 chars) used as the avatar mark when no logo is set.
  badge: "R0",

  // Optional square logo from /public, e.g. "/logo.svg". Replaces the badge.
  logo: "/landing/logo.webp",

  // A preset — "purple", "blue", "sky", "teal", "green", "amber", "orange",
  // "rose", "pink", "zinc" — or any custom hex like "#ff5a1f".
  color: "purple",
};

export default branding;
