import type { ComponentType } from "react";
import type { IconName } from "./data";

// The docs site's table of contents. Each page is an MDX file in
// src/content/docs; its title and description live here (not in the file) so
// the sidebar, page header, metadata and prev/next links share one source.
// To add a page: write the .mdx file, then add an entry below.

type DocModule = { default: ComponentType };

export type DocPage = {
  /** URL path under /docs; "" is the docs home. */
  slug: string;
  title: string;
  description: string;
  load: () => Promise<DocModule>;
};

export type DocSection = { title: string; icon: IconName; pages: DocPage[] };

export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    icon: "flag",
    pages: [
      {
        slug: "",
        title: "Introduction",
        description: "What RoundZero does, how a hackathon moves from setup to winners, and who uses which page.",
        load: () => import("@/content/docs/index.mdx"),
      },
      {
        slug: "quickstart",
        title: "Quickstart",
        description: "Run a hackathon end to end: create it, set up judging, collect projects and publish winners.",
        load: () => import("@/content/docs/quickstart.mdx"),
      },
      {
        slug: "concepts",
        title: "Key concepts",
        description: "The words the app uses — schema blocks, criteria, phases, gates, assignments — and how they fit together.",
        load: () => import("@/content/docs/concepts.mdx"),
      },
    ],
  },
  {
    title: "Tech stack",
    icon: "heart",
    pages: [
      {
        slug: "sponsors",
        title: "Overview",
        description: "What each part of the stack does in RoundZero.",
        load: () => import("@/content/docs/sponsors/index.mdx"),
      },
      {
        slug: "sponsors/nebius-token-factory",
        title: "Nebius Token Factory",
        description: "One OpenAI-compatible API for every model call, with schema-enforced verdicts and chat embeddings.",
        load: () => import("@/content/docs/sponsors/nebius-token-factory.mdx"),
      },
      {
        slug: "sponsors/nebius-sandboxes",
        title: "Nebius Sandboxes",
        description: "VM-isolated sandboxes that clone, build and test every submitted repo.",
        load: () => import("@/content/docs/sponsors/nebius-sandboxes.mdx"),
      },
      {
        slug: "sponsors/tavily",
        title: "Tavily",
        description: "Reading live demos, searching the web and fetching linked pages for the agent and Chat.",
        load: () => import("@/content/docs/sponsors/tavily.mdx"),
      },
      {
        slug: "sponsors/nvidia",
        title: "NVIDIA Nemotron",
        description: "The open models behind the agent's three tiers, its double checks and Chat.",
        load: () => import("@/content/docs/sponsors/nvidia.mdx"),
      },
    ],
  },
  {
    title: "Workspace",
    icon: "grid",
    pages: [
      {
        slug: "workspace/hackathons",
        title: "Your hackathons",
        description: "The home screen: every hackathon you run, with its stage and progress at a glance.",
        load: () => import("@/content/docs/workspace/hackathons.mdx"),
      },
      {
        slug: "workspace/new-hackathon",
        title: "Create a hackathon",
        description: "Start a new event with a name, tagline and dates. It opens with a default schema, criteria, phases and prizes.",
        load: () => import("@/content/docs/workspace/new-hackathon.mdx"),
      },
      {
        slug: "workspace/account",
        title: "Sign in and settings",
        description: "Organizer accounts, signing in, and the read-only instance settings page.",
        load: () => import("@/content/docs/workspace/account.mdx"),
      },
    ],
  },
  {
    title: "Setup",
    icon: "list",
    pages: [
      {
        slug: "setup/schema",
        title: "Schema",
        description: "The fields every project submission has: repo, demo video, team and anything else you ask for.",
        load: () => import("@/content/docs/setup/schema.mdx"),
      },
      {
        slug: "setup/criteria",
        title: "Criteria",
        description: "What projects are scored on, how each criterion is checked, and how much the agent does.",
        load: () => import("@/content/docs/setup/criteria.mdx"),
      },
      {
        slug: "setup/judges",
        title: "Judges",
        description: "Add judges, group them, and give each one a private link.",
        load: () => import("@/content/docs/setup/judges.mdx"),
      },
      {
        slug: "setup/phases",
        title: "Phases",
        description: "Split judging into rounds: who judges each one, how many reviews each project gets, and how many advance.",
        load: () => import("@/content/docs/setup/phases.mdx"),
      },
      {
        slug: "setup/distribution",
        title: "Distribution",
        description: "How projects reach judges: agent screening, the gate-failure inbox, load split, daily batches and the failed-gates rule.",
        load: () => import("@/content/docs/setup/distribution.mdx"),
      },
      {
        slug: "setup/portal",
        title: "Judge portal",
        description: "The start and finish screens judges see on their private link, and every judge's link in one place.",
        load: () => import("@/content/docs/setup/portal.mdx"),
      },
      {
        slug: "setup/branding",
        title: "Branding",
        description: "The hackathon's color, logo and banner, used across the portal, forms and winners page.",
        load: () => import("@/content/docs/setup/branding.mdx"),
      },
      {
        slug: "setup/general",
        title: "General",
        description: "Name, tagline, dates, stage, whether the winners page is public, and deleting the hackathon.",
        load: () => import("@/content/docs/setup/general.mdx"),
      },
    ],
  },
  {
    title: "Judging",
    icon: "eye",
    pages: [
      {
        slug: "judging/projects",
        title: "Projects",
        description: "Every submitted project, how projects get in, and where each one stands.",
        load: () => import("@/content/docs/judging/projects.mdx"),
      },
      {
        slug: "judging/project",
        title: "Project detail",
        description: "One project's submission, agent review, judge scores and controls.",
        load: () => import("@/content/docs/judging/project.mdx"),
      },
      {
        slug: "judging/progress",
        title: "Progress",
        description: "Start judging, watch each phase's reviews come in, and close a phase when it's done.",
        load: () => import("@/content/docs/judging/progress.mdx"),
      },
      {
        slug: "judging/inbox",
        title: "Failed inbox",
        description: "Projects the agent stopped at a gate, waiting for a human to make the call.",
        load: () => import("@/content/docs/judging/inbox.mdx"),
      },
      {
        slug: "judging/rewards",
        title: "Rewards",
        description: "Prizes and places, and the emails winners and participants receive.",
        load: () => import("@/content/docs/judging/rewards.mdx"),
      },
      {
        slug: "judging/chat",
        title: "Chat",
        description: "Ask questions about projects, scores and agent reviews, scoped to the projects you pick, with web lookups.",
        load: () => import("@/content/docs/judging/chat.mdx"),
      },
    ],
  },
  {
    title: "Results",
    icon: "trophy",
    pages: [
      {
        slug: "results/winners",
        title: "Winners",
        description: "Final rankings, choosing award winners, publishing the results and emailing every project.",
        load: () => import("@/content/docs/results/winners.mdx"),
      },
      {
        slug: "results/emails",
        title: "Winner emails",
        description: "Preview the email each winning project gets, listing every prize it won.",
        load: () => import("@/content/docs/results/emails.mdx"),
      },
    ],
  },
  {
    title: "Shared links",
    icon: "link",
    pages: [
      {
        slug: "links/judge-portal",
        title: "Judge link",
        description: "The private page each judge uses to review and score their projects.",
        load: () => import("@/content/docs/links/judge-portal.mdx"),
      },
      {
        slug: "links/submission-form",
        title: "Submission form",
        description: "The public form teams use to submit their project.",
        load: () => import("@/content/docs/links/submission-form.mdx"),
      },
      {
        slug: "links/winners-page",
        title: "Winners page",
        description: "The public page announcing a hackathon's winners.",
        load: () => import("@/content/docs/links/winners-page.mdx"),
      },
    ],
  },
  {
    title: "Reference",
    icon: "code",
    pages: [
      {
        slug: "reference/intake-api",
        title: "Intake API",
        description: "Send projects in from another system with one HTTP request.",
        load: () => import("@/content/docs/reference/intake-api.mdx"),
      },
      {
        slug: "reference/configuration",
        title: "Configuration",
        description: "branding.config.js, environment variables, and which hosts show the landing page.",
        load: () => import("@/content/docs/reference/configuration.mdx"),
      },
      {
        slug: "reference/deployment",
        title: "Deployment",
        description: "Run your own RoundZero: Supabase, environment, and deploying the app.",
        load: () => import("@/content/docs/reference/deployment.mdx"),
      },
    ],
  },
];

const ALL = DOC_SECTIONS.flatMap((section) => section.pages.map((page) => ({ ...page, section: section.title })));

export function docHref(slug: string) {
  return slug ? `/docs/${slug}` : "/docs";
}

export function findDoc(slug: string) {
  const i = ALL.findIndex((p) => p.slug === slug);
  if (i === -1) return null;
  return { page: ALL[i], prev: ALL[i - 1] ?? null, next: ALL[i + 1] ?? null };
}

export function allDocSlugs() {
  return ALL.map((p) => p.slug);
}

/** The sidebar, without the loaders, so it can cross into a client component. */
export type DocsNav = { title: string; icon: IconName; pages: { href: string; title: string }[] }[];

export function docsNav(): DocsNav {
  return DOC_SECTIONS.map((s) => ({
    title: s.title,
    icon: s.icon,
    pages: s.pages.map((p) => ({ href: docHref(p.slug), title: p.title })),
  }));
}
