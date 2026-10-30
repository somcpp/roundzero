import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FunnelPixels } from "@/app/h/[slug]/judging/progress/funnel-pixels";
import { BrandMark } from "@/components/brand-mark";
import { PixelIcon } from "@/components/pixel-icon";
import { brand } from "@/lib/branding";
import type { IconName } from "@/lib/data";
import { DEMO_MODE } from "@/lib/demo";
import { NebiusLogo, NvidiaLogo, TavilyLogo } from "./_components/brand-logos";
import { GetStarted, TryDemo } from "./_components/cta";
import { AiOnlyJudge, JudgeQueue, RankingTable, SubmissionFlood, Tag } from "./_components/mocks";
import { PixelDither } from "./_components/pixel-dither";
import { ScreenTour, type Shot } from "./_components/screen-tour";
import { IconRow, Reveal, Section, Showcase } from "./_components/section";
import { SiteHeader } from "./_components/site-header";

// The marketing page. Only served on the site hosts (lib/site.ts):
// the proxy rewrites "/" here for signed-out visitors.

export default function LandingPage() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <Hero />
        <AiJudges />
        <WhyHackathons />
        <Flood />
        <Split />
        <Stack />
        <Demo />
        <Judges />
        <Rounds />
      </main>
      <Finale />
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────

const SPONSORS: { logo: ReactNode; name?: string; role: string }[] = [
  { logo: <NvidiaLogo className="h-6 w-auto text-[var(--silver)]" />, name: "Nemotron", role: "Runs every model the agent uses" },
  { logo: <NebiusLogo className="h-6 w-auto" />, name: "Sandboxes", role: "Builds and runs submitted code (optional)" },
  { logo: <TavilyLogo dark className="h-8 w-auto" />, role: "Reads the live web" },
];

function Hero() {
  return (
    <>
      {/* The art fades to white at its foot, so the hero runs straight into the page. On large screens the
          section matches the art's 16:9 so it shows whole; smaller screens get extra room below the copy so
          the text stays on the dark sky and the white foot sits under the card. */}
      <section className="relative -mt-20 overflow-hidden pt-32 pb-40 text-center sm:pt-36 sm:pb-48 lg:h-[max(56.25vw,50rem)] lg:pt-32 lg:pb-0">
        <Image src="/landing/retro-hero.webp" alt="" fill preload sizes="100vw" className="object-cover object-top" />
        {/* Night sky pulled in behind the copy, so it reads over the clouds too. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_100%_48%_at_50%_32%,rgba(21,12,46,0.85),rgba(21,12,46,0.4)_60%,transparent_88%)] lg:bg-[radial-gradient(ellipse_62%_50%_at_50%_36%,rgba(21,12,46,0.9),rgba(21,12,46,0.55)_55%,transparent_85%)]"
        />
        {/* A longer white foot than the art's own, so the card below lands on white. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[17rem] bg-[linear-gradient(to_bottom,transparent,#fff_85%)] sm:h-[20rem] lg:h-[26%]"
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <h1 className="reveal m-0 mx-auto max-w-5xl text-[2.4rem] xl:max-w-6xl leading-[1.05] text-pretty text-white text-shadow-lg text-shadow-purple-950/60 sm:text-5xl xl:text-6xl">
            Hackathon Judging
            <br />
            <span className="text-sunset hero-glow">Agent &amp; Management</span>
          </h1>
          <p className="reveal reveal-delay-1 mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-pretty text-white text-shadow-md text-shadow-purple-950/70 sm:text-xl">
            Collect submissions, run judging rounds and announce winners, all in one place. The {brand.name}{" "}
            agent, built on NVIDIA Nemotron and Nebius, checks each project&rsquo;s code and demo against your rules, so your judges can
            spend their time on the ideas.
          </p>
          <div className="reveal reveal-delay-2 mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <GetStarted />
            {/* With the demo login on, the demo takes the second button. The docs stay in the nav. */}
            {DEMO_MODE ? (
              <TryDemo />
            ) : (
              <Link href="/docs" className="btn-arcade btn-arcade--light">
                Read the docs
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto mt-16 flex max-w-4xl flex-col items-center px-6 text-center">
        <p className="thanks-badge m-0 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-balance sm:rounded-full">
          <PixelIcon name="heart" size={13} className="text-[var(--magenta)]" />
          <span>Powered by</span>
        </p>
        <div className="mt-8 flex flex-wrap items-start justify-center gap-x-14 gap-y-6">
          {SPONSORS.map((s) => (
            <div key={s.role}>
              <div className="flex h-8 items-center justify-center gap-2 text-lg font-semibold">
                {s.logo}
                {s.name}
              </div>
              <div className="mt-1.5 text-sm text-[var(--muted)]">{s.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* A hairline with a sparkle, closing the hero before the first section. */}
      <div aria-hidden className="mx-auto mt-20 flex max-w-4xl items-center gap-4 px-6">
        <span className="h-px flex-1 bg-[linear-gradient(to_right,transparent,rgba(124,58,237,0.35))]" />
        <PixelIcon name="spark" size={16} className="text-[var(--violet)]" />
        <span className="h-px flex-1 bg-[linear-gradient(to_left,transparent,rgba(124,58,237,0.35))]" />
      </div>
    </>
  );
}

// ── Why AI alone is a bad judge ───────────────────────────────────────────

const AI_STRENGTHS: { icon: IconName; verb: string; text: string }[] = [
  { icon: "check", verb: "Verify", text: "Does it call your API? Does it build and pass its tests?" },
  { icon: "tag", verb: "Classify", text: "Which projects are most alike?" },
  { icon: "check-list", verb: "Confirm", text: "Does it meet the base requirements, like a public repo and a demo under three minutes?" },
  { icon: "notebook", verb: "Summarize", text: "A few sentences on what each project is and how it did on your checks." },
];

function AiJudges() {
  return (
    <Section
      id="ai-judges"
      center
      headline="AI makes a bad hackathon judge"
      subheadline="Most submissions are written with AI now, so they're tuned to hit every note in your requirements. An AI judge grades work shaped like its own, and it can give 8 lines of code a 10 out of 10."
    >
      <Reveal delay={0.05} className="mt-12 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <div className="tint-card flex min-w-0 flex-col gap-6 p-6 sm:p-8">
          <div>
            <h3 className="display m-0 text-2xl leading-tight">AI grading AI</h3>
            <p className="m-0 mt-2 leading-relaxed text-[var(--muted)]">
              The project says all the right things, so it gets full marks.
            </p>
          </div>
          <AiOnlyJudge />
        </div>
        <div className="relative rounded-3xl border border-[var(--line-soft)] bg-white p-7 shadow-[0_18px_48px_-24px_rgba(124,58,237,0.35)] sm:p-8">
          <span aria-hidden className="absolute inset-x-8 top-0 h-[2px] rounded-full" style={{ background: "var(--dusk)" }} />
          <h3 className="display m-0 text-2xl leading-tight">What AI is good at</h3>
          <p className="m-0 mt-2 leading-relaxed text-[var(--muted)]">
            It can&rsquo;t judge the idea, novelty, or creativity behind a project. It can do the groundwork, so a person can.
          </p>
          <ul className="m-0 mt-6 flex list-none flex-col gap-5 p-0">
            {AI_STRENGTHS.map((a) => (
              <IconRow key={a.verb} icon={<PixelIcon name={a.icon} size={13} />} title={a.verb}>
                {a.text}
              </IconRow>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={0.08} className="mx-auto mt-12 max-w-3xl text-center">
        <p className="display m-0 text-2xl leading-snug text-pretty sm:text-3xl">
          {brand.name} doesn&rsquo;t replace human judges.
          <br />
          <span className="text-dusk">It lets them judge at scale.</span>
        </p>
      </Reveal>
    </Section>
  );
}

// ── Why run a hackathon ───────────────────────────────────────────────────

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "users",
    title: "Developers who know your product",
    text: "Every team has to learn your product well enough to ship something with it. Some keep building after the event.",
  },
  {
    icon: "chat",
    title: "Feedback on your docs and API",
    text: "People working to a deadline find the confusing errors and missing examples fast, and they tell you about them.",
  },
  {
    icon: "spark",
    title: "Use cases you hadn't thought of",
    text: "Teams point your product at problems that weren't on your roadmap, and some of those ideas are worth a closer look.",
  },
  {
    icon: "play",
    title: "Demos and examples",
    text: "Each project comes with a repo and a demo video. With the team's permission, the best ones make good examples and tutorials for your docs.",
  },
];

function WhyHackathons() {
  return (
    <Section
      id="why-hackathons"
      headline="Hackathons get your product into builders' hands"
      subheadline="Give developers a deadline and a reason to build something real on your API, SDK or model."
    >
      <Reveal delay={0.05} className="mt-12 grid gap-4 md:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl border border-[var(--line-soft)] bg-white p-6">
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--violet-soft)] text-[var(--violet)]">
              <PixelIcon name={b.icon} size={14} />
            </span>
            <h3 className="m-0 mt-4 text-lg font-semibold">{b.title}</h3>
            <p className="m-0 mt-1.5 leading-relaxed text-[var(--muted)]">{b.text}</p>
          </div>
        ))}
      </Reveal>
      <Reveal
        delay={0.08}
        className="tint-card relative mt-4 grid gap-5 p-7 sm:p-9 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-10"
      >
        <span aria-hidden className="absolute inset-x-8 top-0 h-[2px] rounded-full" style={{ background: "var(--dusk)" }} />
        <div className="flex items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "var(--dusk)" }}>
            <PixelIcon name="trophy" size={18} />
          </span>
          <h3 className="display m-0 text-2xl leading-tight">Pick winners for their ideas</h3>
        </div>
        <p className="m-0 leading-relaxed text-[var(--muted)]">
          If you judge on technical features alone, a polished project built with coding agents can beat a better idea. And if
          the team that ran the most coding agents wins, expect more of the same at your next hackathon. {brand.name} hands the
          technical checks to its agent and leaves the ideas to your judges.{" "}
          <a href="#split" className="nav-link font-medium whitespace-nowrap text-[var(--violet)]">
            See how it works →
          </a>
        </p>
      </Reveal>
    </Section>
  );
}

// ── The flood ─────────────────────────────────────────────────────────────

function Flood() {
  return (
    <Section
      id="flood"
      headline="Coding agents multiplied the submissions"
      subheadline="With a coding agent, a small team can ship a working app over a weekend. Your judging panel stayed the same size."
    >
      <Showcase
        title="Ten times the projects for the same three judges"
        description="Someone still has to look at each one, and the projects at the bottom of the pile get the tired judges."
        media={<SubmissionFlood />}
      />
    </Section>
  );
}

// ── The split ─────────────────────────────────────────────────────────────

const AGENT_CHECKS: { icon: IconName; question: string; via: string }[] = [
  { icon: "gear", question: "Does it build and pass its tests?", via: "Sandbox run" },
  { icon: "search", question: "Does it call your API or SDK?", via: "Code scraper" },
  { icon: "play", question: "Is the demo video under the time limit?", via: "Video reviewer" },
  { icon: "globe", question: "Is the live demo up?", via: "Web scraper" },
];

const HUMAN_ONLY = (
  <Tag tone="human" icon="user">
    Human only
  </Tag>
);

const JUDGE_CALLS: { name: string; question: string; chip: ReactNode }[] = [
  { name: "Quality of the idea", question: "Is it new, and is it worth doing?", chip: HUMAN_ONLY },
  { name: "Potential impact", question: "Who is it for, and how much would it help them?", chip: HUMAN_ONLY },
  { name: "Design", question: "Is it clear, and was it made with care?", chip: HUMAN_ONLY },
];

function Split() {
  return (
    <Section
      id="split"
      headline={`${brand.name} checks the code so your judges can score the idea`}
      subheadline={`A coding agent can write the app, but the idea and the taste behind it still come from the team. You choose, criterion by criterion, where the ${brand.name} agent helps and where it stays out.`}
    >
      <Reveal delay={0.05} className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-[var(--line-soft)] bg-[var(--tint)] p-7 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--violet-soft)] text-[var(--violet)]">
              <PixelIcon name="spark" size={16} />
            </span>
            <h3 className="display m-0 text-2xl leading-tight">What the {brand.name} agent checks</h3>
          </div>
          <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
            {AGENT_CHECKS.map((c) => (
              <li key={c.question} className="flex items-start gap-3">
                <PixelIcon name={c.icon} size={14} className="mt-1 shrink-0 text-[var(--violet)]" />
                <span className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <span className="font-semibold">{c.question}</span>
                  <Tag className="self-start">{c.via}</Tag>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative rounded-3xl border border-[var(--line-soft)] bg-white p-7 shadow-[0_18px_48px_-24px_rgba(232,49,143,0.35)] sm:p-8">
          <span aria-hidden className="absolute inset-x-8 top-0 h-[2px] rounded-full" style={{ background: "var(--dusk)" }} />
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: "var(--dusk)" }}>
              <PixelIcon name="users" size={16} />
            </span>
            <h3 className="display m-0 text-2xl leading-tight">What your judges decide</h3>
          </div>
          <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
            {JUDGE_CALLS.map((c) => (
              <li key={c.name} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-[0.95rem] text-[var(--muted)]">{c.question}</span>
                </span>
                <span className="self-start">{c.chip}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={0.08} className="mx-auto mt-8 max-w-3xl text-center">
        <p className="m-0 text-[var(--muted)]">Judges still score every criterion. Set one to Human only and the agent leaves it alone.</p>
      </Reveal>

      <Showcase
        flip
        title="You and your judges pick the winners"
        description={
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            <IconRow icon={<PixelIcon name="users" size={13} />} title="Ranked by your judges">
              Projects that pass your gates rank by your judges&rsquo; average score. The agent&rsquo;s score only breaks ties.
            </IconRow>
            <IconRow icon={<PixelIcon name="inbox" size={13} />} title="Gate failures come to you">
              When the agent fails a project on a gate, the project waits in your inbox. Keep it out, or put it back in the pool.
            </IconRow>
            <IconRow icon={<PixelIcon name="crown" size={13} />} title="You set the final order">
              After the last round closes, you can drag projects into a different order before you publish, and you pick the award
              winners yourself.
            </IconRow>
          </ul>
        }
        media={<RankingTable />}
      />
    </Section>
  );
}

// ── Nebius × NVIDIA ───────────────────────────────────────────────────────

const TIERS = [
  { tier: "Quick", model: "Nemotron 3.5 Lightning", does: "One pass over what the checks found." },
  { tier: "Balanced", model: "Nemotron 3 Super 120B", does: "Checks a few things itself with tools. It also runs chat." },
  { tier: "In-depth", model: "Nemotron 3 Ultra 550B", does: "The largest model, with the most tool calls." },
];

const TAVILY = [
  { verb: "Extract", does: "reads a project's pages." },
  { verb: "Crawl", does: "walks the live demo on In-depth criteria, following your instructions." },
  { verb: "Search", does: "checks whether an idea already exists on the web." },
];

function Stack() {
  return (
    <div id="stack" className="night relative scroll-mt-20 overflow-hidden">
      <div aria-hidden className="stars absolute inset-0 opacity-60" />
      <section className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <Reveal className="max-w-3xl">
          <h2 className="m-0 text-4xl leading-[1.05] tracking-wide text-pretty sm:text-6xl">
            NVIDIA&rsquo;s open models on Nebius let the agent <span className="text-sunset">check every project</span>
          </h2>
          <p className="m-0 mt-6 max-w-2xl text-xl leading-relaxed text-pretty text-[var(--on-dark-muted)]">
            Checking 1,000 projects means building 1,000 repos of untrusted code and making a lot of model calls. Nebius runs
            both. NVIDIA Nemotron models do the agent&rsquo;s scoring, and Tavily reads the live web.
          </p>
        </Reveal>

        <Reveal delay={0.06} className="mt-14 grid gap-4 lg:grid-cols-2">
          <StackCard logo={<NvidiaLogo className="h-7 w-auto text-white" />} name="Nemotron">
            <p className="m-0">
              Out of the box, every agent score and pass/fail verdict comes from a Nemotron model. You pick the tier for each
              criterion.
            </p>
            <ul className="m-0 mt-5 flex list-none flex-col gap-2.5 p-0">
              {TIERS.map((t) => (
                <li key={t.tier} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-xl bg-white/5 px-3.5 py-2.5">
                  <span className="pt-0.5 text-sm font-medium text-[#f0abfc]">{t.tier}</span>
                  <span>
                    <span className="block font-medium text-[var(--on-dark)]">{t.model}</span>
                    <span className="block text-sm">{t.does}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-4 text-sm">
              <span className="font-semibold text-[var(--on-dark)]">Double check.</span> When a verdict has low confidence, raises
              a flag or fails a gate, the agent runs it again one tier up. In-depth criteria get a second Ultra pass. That&rsquo;s
              the default, and you can switch it to Always or Off.
            </p>
            <p className="m-0 mt-3 text-sm">Vision models on Token Factory describe the demo video&rsquo;s frames. A Nemotron model does the agent&rsquo;s scoring.</p>
          </StackCard>

          <div className="grid gap-4">
            <StackCard logo={<NebiusLogo className="h-7 w-auto" />} name="Token Factory">
              <p className="m-0">
                Token Factory serves the model calls and the embeddings behind chat search. Each repo is cloned into a VM-isolated
                Nebius Sandbox, and each review step works on its own fork, so one step&rsquo;s installs never touch
                another&rsquo;s.
              </p>
            </StackCard>
            <StackCard logo={<TavilyLogo className="h-9 w-auto" />}>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {TAVILY.map((t) => (
                  <li key={t.verb}>
                    <span className="font-semibold text-[var(--on-dark)]">{t.verb}</span> {t.does}
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3 text-sm">Chat uses it to search the web too.</p>
            </StackCard>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/** A night-band card headed by a sponsor's logo, plus the product name when the logo doesn't spell it out. */
function StackCard({ logo, name, children }: { logo: ReactNode; name?: string; children: ReactNode }) {
  return (
    <div className="night-card flex flex-col px-6 py-6 sm:px-7 sm:py-7">
      <h3 className="display m-0 flex min-h-8 items-center gap-3 text-2xl text-[var(--on-dark)]">
        {logo}
        {name}
      </h3>
      <div className="mt-4 leading-relaxed text-[var(--on-dark-muted)]">{children}</div>
    </div>
  );
}

// ── Demo ──────────────────────────────────────────────────────────────────

// The screen tour under the demo video, in the order a hackathon runs, then the
// sponsor stack. Each image carries its own headline; `title` repeats it for
// screen readers.
const SHOTS: Shot[] = [
  {
    file: "01-schema.png",
    chapter: "Setup",
    title: "Shape every submission.",
    alt: "Setup, Schema: the blocks every submission fills in, such as title, video, live demo, GitHub and team. Each block has a hint for entrants and a note on what the agent should expect.",
  },
  {
    file: "02-criteria-inputs.png",
    chapter: "Setup",
    title: "Say how each criterion gets checked.",
    alt: "Setup, Criteria: a criterion reads the blocks you pick, and you choose how it's checked: agent judge, sandbox run, video reviewer, code scraper, web scraper or human only.",
  },
  {
    file: "03-criteria-agent.png",
    chapter: "Setup",
    title: "Pick the model. Run the code.",
    alt: "Setup, Criteria, Agent: the Quick, Balanced or In-depth Nemotron model, the commands to run in a Nebius sandbox, and when to double-check a verdict.",
  },
  {
    file: "04-phases.png",
    chapter: "Setup",
    title: "Rounds that narrow the field.",
    alt: "Setup, Phases: group review, semifinal and final panel, each with its judges, reviews per project and how many projects move on.",
  },
  {
    file: "05-distribution.png",
    chapter: "Setup",
    title: "Hand out the work fairly.",
    alt: "Setup, Distribution: the agent reviews first, queues are even or mixed and go out all at once or in daily batches, and judges see the agent's score only after submitting their own.",
  },
  {
    file: "06-judge-portal.png",
    chapter: "Setup",
    title: "No accounts. Just a private link.",
    alt: "Setup, Judge portal: a private link for each judge, the welcome message and goals they read, and a preview of their start screen.",
  },
  {
    file: "07-projects.png",
    chapter: "Judging",
    title: "Projects come in from anywhere.",
    alt: "Judging, Projects: projects imported through the API or sent in through a public submission form built from your schema.",
  },
  {
    file: "08-agent-review.png",
    chapter: "Judging",
    title: "The agent takes round one.",
    alt: "Judging, Agent review: the agent scores a project 7.3 out of 10 with its gates passed, lists strengths and things to improve, and flags a disagreement for a person to decide.",
  },
  {
    file: "09-agent-step.png",
    chapter: "Judging",
    title: "Evidence behind every score.",
    alt: "Judging, one agent review step: the evidence from the sandbox run, live sites, video transcript and repo, a note to steer a rerun, and every step the agent took.",
  },
  {
    file: "10-judge-view.png",
    chapter: "Judging",
    title: "Judges score the idea.",
    alt: "Judging, Scoring: a judge sees the pitch, video, demo, repo and team on one page and scores each criterion from 1 to 10, with a weighted running total.",
  },
  {
    file: "11-project.png",
    chapter: "Judging",
    title: "Every project on one page.",
    alt: "Judging, Project page: a project's final rank, every prize and award it won, and the final panel's averaged scores.",
  },
  {
    file: "12-progress.png",
    chapter: "Judging",
    title: "See every round at a glance.",
    alt: "Judging, Progress: how many projects each round reviewed and advanced, the funnel from submitted to winners, and a button to run the agent.",
  },
  {
    file: "13-chat.png",
    chapter: "Judging",
    title: "Ask across every project.",
    alt: "Judging, Chat: a question about the final panel answered from the hackathon's own scores, scoped to a set of projects, by NVIDIA Nemotron on Nebius.",
  },
  {
    file: "14-rewards.png",
    chapter: "Judging",
    title: "Set the prizes once.",
    alt: "Judging, Rewards: prizes by final rank and awards you pick, with what each winner gets listed for their email.",
  },
  {
    file: "15-results.png",
    chapter: "Results",
    title: "Rank, publish, tell everyone.",
    alt: "Results, Winners: publish the winners page, email winners their prizes and everyone else a thank-you, and see the final podium.",
  },
  {
    file: "16-winners.png",
    chapter: "Results",
    title: "Winners, announced.",
    alt: "Results, public winners page: the hackathon's own colors and logo, the top three projects, and the prizes each one won.",
  },
  {
    file: "image-1790746245045.png",
    chapter: "Stack",
    title: "Where NVIDIA, Nebius and Tavily do the work.",
    alt: "Where NVIDIA, Nebius and Tavily do the work: Nemotron models make every judging call, Nebius Token Factory serves the models and runs every repo in a sandbox, and Tavily reads the live web.",
  },
];

function Demo() {
  return (
    <Section
      id="demo"
      center
      headline="One hackathon, from rubric to winners page"
      subheadline={`Setup, judging and results in ${brand.name}, screen by screen. Click one to see it full size.`}
    >
      <Reveal delay={0.08} className="mt-12">
        <ScreenTour shots={SHOTS} label={`${brand.name} screens`} />
      </Reveal>
      {DEMO_MODE ? (
        <Reveal delay={0.1} className="mx-auto mt-14 flex max-w-xl flex-col items-center gap-6 text-center">
          <div>
            <h3 className="display m-0 text-2xl leading-tight">Take it for a spin</h3>
            <p className="m-0 mt-2 leading-relaxed text-pretty text-[var(--muted)]">
              Sign in to the demo and you&rsquo;ll find three sample hackathons: one finished, one{" "}
              <span className="whitespace-nowrap">mid-judging</span> and one just set up. Click anything you like. Nothing you
              change is saved.
            </p>
          </div>
          <TryDemo />
        </Reveal>
      ) : null}
    </Section>
  );
}

// ── Judges ────────────────────────────────────────────────────────────────

function Judges() {
  return (
    <Section
      id="judges"
      headline="A queue a judge can finish"
      subheadline="You can release a round in daily batches, so a judge only sees today's projects. Each judge gets the projects in a different order, which keeps the same few from always landing at the tired end."
    >
      <Showcase
        title="Built for the judge on project forty"
        description={
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            <IconRow icon={<PixelIcon name="link" size={13} />} title="No account needed">
              Judges open their private link and start. They see only their own queue.
            </IconRow>
            <IconRow icon={<PixelIcon name="check-list" size={13} />} title="A time estimate up front">
              The start screen shows how many projects are waiting, what they&rsquo;ll score and about how long it will take.
            </IconRow>
            <IconRow icon={<PixelIcon name="eye" size={13} />} title="Score first, then compare">
              A judge sees the agent&rsquo;s verdict only after submitting their own scores. Gaps of 2 points or more get flagged,
              and the judge can change their score once.
            </IconRow>
            <IconRow icon={<PixelIcon name="lock" size={13} />} title="Scores stay private">
              Judges never see each other&rsquo;s scores, so one judge can&rsquo;t anchor the rest.
            </IconRow>
          </ul>
        }
        media={<JudgeQueue />}
      />
    </Section>
  );
}

// ── Rounds ────────────────────────────────────────────────────────────────

const FUNNEL = [
  { key: "submitted", name: "Submitted", color: "#7c3aed", count: 186, note: "all projects" },
  { key: "screening", name: "Screening", color: "#c026d3", count: 142, note: "passed the gates" },
  { key: "round-1", name: "Round 1", color: "#f43f5e", count: 40, note: "64% reviewed", live: true },
  { key: "finals", name: "Finals", color: "#fb923c", count: 12, note: "top 12 planned", faded: true },
];

function Rounds() {
  return (
    <Section
      id="rounds"
      headline="A smaller pile each round"
      subheadline="Set the gates a project must pass and how many projects advance. Then watch each round fill in, and close it when it's done."
      aside={
        <Link href="/docs/setup/phases" className="nav-link text-sm font-medium text-[var(--violet)]">
          Read the docs →
        </Link>
      }
    >
      <Reveal delay={0.05} className="mt-12">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="mock relative min-w-[36rem] overflow-hidden">
            <ol className="m-0 grid list-none grid-cols-4 p-0">
              {FUNNEL.map((s, i) => (
                <li key={s.key} className={i > 0 ? "flex flex-col border-l border-[var(--line-soft)]" : "flex flex-col"}>
                  <div className="flex flex-col gap-1.5 px-5 pt-5 pb-3">
                    <span className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
                      <span className="size-2 rounded-sm" style={{ background: s.color, opacity: s.faded ? 0.4 : 1 }} />
                      {s.name}
                      {i === FUNNEL.length - 1 ? <PixelIcon name="trophy" size={10} /> : null}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className={s.faded ? "display text-3xl leading-none text-[var(--faint)]" : "display text-3xl leading-none"}>
                        {s.count}
                      </span>
                      {s.live ? (
                        <span className="ml-auto flex items-center gap-1.5 self-center rounded-full bg-[var(--violet-soft)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--violet)]">
                          <span className="live-dot size-1.5 rounded-full bg-[var(--violet)]" />
                          live
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{s.note}</span>
                  </div>
                  <div className="h-[180px] sm:h-[220px]" />
                </li>
              ))}
            </ol>
            <FunnelPixels
              bands={FUNNEL.map((s) => ({ key: s.key, color: s.color, count: s.count, faded: !!s.faded, live: !!s.live }))}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[180px] w-full sm:h-[220px]"
            />
          </div>
        </div>
      </Reveal>

    </Section>
  );
}

// ── Final call and footer, on the neon floor ──────────────────────────────

function Finale() {
  return (
    <div className="relative overflow-hidden bg-[var(--screen-deep)]">
      <Image src="/landing/retro-footer.webp" alt="" fill sizes="100vw" className="object-cover object-bottom" />
      {/* The white page breaks into pixels as it meets the night sky. */}
      <PixelDither id="finale-seam" color="#ffffff" cell={8} steps={[14, 10, 6, 2]} className="absolute inset-x-0 top-0 z-[1]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_58%,rgba(21,12,46,0.55),transparent_75%)]" />

      <section className="relative mx-auto max-w-4xl px-6 pt-[12rem] pb-28 text-center sm:pt-[14rem]">
        <Reveal>
          <h2 className="m-0 text-4xl leading-[1.05] text-balance text-white sm:text-6xl">
            Run your <span className="text-sunset">next hackathon</span> on {brand.name}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/85">
            Sign in and set up your first hackathon with your own brand and rubric, or look around the demo first.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <GetStarted />
            {/* With the demo login on, the demo takes the second button. */}
            {DEMO_MODE ? (
              <TryDemo />
            ) : (
              <Link href="/docs" className="btn-arcade btn-arcade--light">
                Read the docs
              </Link>
            )}
          </div>
        </Reveal>
      </section>

      <footer className="relative px-6 pb-12">
        <div className="mx-auto flex max-w-fit flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-white/15 bg-[rgba(21,12,46,0.6)] px-6 py-3.5 backdrop-blur-md">
          <span aria-hidden className="flex">
            <BrandMark className="size-5" badgeClassName="bg-white text-[0.5rem] text-[var(--screen-deep)]" />
          </span>
          <p className="mono m-0 text-[0.7rem] tracking-[0.16em] text-[var(--on-dark-muted)]">
            {brand.name} ·{" "}
            {DEMO_MODE ? (
              <>
                <Link href="/login" className="text-inherit underline decoration-white/30 underline-offset-2 hover:text-white">
                  Try the demo
                </Link>{" "}
                ·{" "}
              </>
            ) : null}
            <Link href="/login" className="text-inherit underline decoration-white/30 underline-offset-2 hover:text-white">
              Sign in
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
