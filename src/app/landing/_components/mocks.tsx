import type { ReactNode } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import type { IconName } from "@/lib/data";

// Mocks for the landing page: the hero's three steps, an AI-only judge's
// scorecard, the submission flood, the judge portal and a phase's ranking.
// The RoundZero screens use the app's own labels.

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ── Pieces ────────────────────────────────────────────────────────────────

type Tone = "pass" | "gate" | "agent" | "human" | "neutral" | "flag";

const TONES: Record<Tone, string> = {
  pass: "bg-[var(--pass-soft)] text-[var(--pass)]",
  gate: "bg-[var(--warn-soft)] text-[var(--warn)]",
  agent: "bg-[var(--violet-soft)] text-[var(--violet)]",
  human: "border border-dashed border-[var(--line)] text-[var(--muted)]",
  neutral: "bg-[var(--tint-strong)] text-[var(--muted)]",
  flag: "bg-[#ffe4f1] text-[#be185d]",
};

export function Tag({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] leading-5 font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon ? <PixelIcon name={icon} size={9} /> : null}
      {children}
    </span>
  );
}

const FACES = [
  "linear-gradient(135deg, #a78bfa, #7c3aed)",
  "linear-gradient(135deg, #f9a8d4, #e8318f)",
  "linear-gradient(135deg, #fdba74, #fb7a3c)",
];

export function Face({ name, i = 0, size = 26, className }: { name: string; i?: number; size?: number; className?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      aria-hidden
      className={cx("grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white", className)}
      style={{ width: size, height: size, background: FACES[i % FACES.length], fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}

/** The app's segmented score bar, in dusk colors. */
function Meter({ value, max = 10, count = 10, className }: { value: number; max?: number; count?: number; className?: string }) {
  const filled = Math.round((value / max) * count);
  return (
    <span className={cx("flex gap-[3px]", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-[2px]"
          style={{
            background: i < filled ? `color-mix(in oklab, #7c3aed, #e8318f ${Math.round((i / (count - 1)) * 100)}%)` : "var(--tint-strong)",
          }}
        />
      ))}
    </span>
  );
}

function IconTile({ icon, tone = "agent", className }: { icon: IconName; tone?: "agent" | "human"; className?: string }) {
  return (
    <span
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-lg",
        tone === "agent" ? "bg-[var(--violet-soft)] text-[var(--violet)]" : "border border-dashed border-[var(--line)] text-[var(--muted)]",
        className,
      )}
    >
      <PixelIcon name={icon} size={13} />
    </span>
  );
}

function ProjectMark({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-bold text-white"
      style={{ width: size, height: size, background: "var(--dusk)", fontSize: Math.round(size * 0.34) }}
    >
      {text}
    </span>
  );
}

const JUDGES = ["Ada Lovelace", "Grace Hopper", "Linus Park"];

// ── Why AI alone is a bad judge: a scorecard that grades its own kind ─────

const AI_ONLY_ROWS: { label: string; value: ReactNode }[] = [
  {
    label: "Uses the sponsor API",
    value: (
      <Tag tone="pass" icon="check">
        Yes
      </Tag>
    ),
  },
  {
    label: "README covers every criterion",
    value: (
      <Tag tone="pass" icon="check">
        Yes
      </Tag>
    ),
  },
  { label: "README", value: <span className="text-sm text-[var(--muted)]">1,400 words</span> },
  {
    label: "Code",
    value: (
      <Tag tone="flag" icon="flag">
        8 lines
      </Tag>
    ),
  },
];

export function AiOnlyJudge() {
  return (
    <div className="mock w-full overflow-hidden text-left">
      <div className="flex items-center gap-3 border-b border-[var(--line-soft)] px-5 py-4">
        <ProjectMark text="NC" size={36} />
        <div className="min-w-0">
          <div className="truncate text-[0.95rem] font-semibold">Nexus Copilot</div>
          <div className="text-xs text-[var(--muted)]">Project #317 · built with a coding agent</div>
        </div>
        <Tag icon="spark" className="ml-auto">
          AI-only judge
        </Tag>
      </div>
      <ul className="m-0 list-none divide-y divide-[var(--line-soft)] p-0">
        {AI_ONLY_ROWS.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <span className="text-[0.92rem]">{r.label}</span>
            {r.value}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line-soft)] bg-[#fff5fa] px-5 py-4">
        <span className="flex items-baseline gap-1.5">
          <span className="display text-4xl leading-none">10</span>
          <span className="display text-lg leading-none text-[var(--faint)]">/10</span>
        </span>
        <span className="text-xs leading-snug text-[#be185d]">
          Scored by the same kind of model
          <br />
          that wrote it
        </span>
      </div>
    </div>
  );
}

// ── The shift: a hackathon's worth of submissions, then and now ────────────

const VIOLETS = ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed"];
const SUNSET = ["#fcd34d", "#fb923c", "#f43f5e", "#e11d8f", "#a21caf"];

/** A steady 0–1 value per cell, so the field looks hand-placed but renders the same every time. */
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function PixelField({ cols, rows, palette, label }: { cols: number; rows: number; palette: string[]; label: string }) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    // Rows band through the palette top to bottom, like the striped sun.
    const color = palette[Math.min(palette.length - 1, Math.floor((r / rows) * palette.length))];
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      cells.push(
        <rect key={i} x={c * 10} y={r * 10} width={8} height={8} rx={1.5} fill={color} opacity={0.5 + 0.5 * noise(i)} />,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${cols * 10 - 2} ${rows * 10 - 2}`} className="block h-auto w-full" role="img" aria-label={label}>
      {cells}
    </svg>
  );
}

export function SubmissionFlood() {
  return (
    <div className="mock w-full max-w-xl p-6 sm:p-7">
      <div className="grid grid-cols-[1fr_4fr] items-end gap-5">
        <PixelField cols={10} rows={10} palette={VIOLETS} label="About 100 submissions" />
        <PixelField cols={40} rows={25} palette={SUNSET} label="More than 1,000 submissions" />
        <div>
          <div className="display text-2xl leading-none">~100</div>
          <div className="mt-1.5 text-xs leading-snug text-[var(--muted)]">hand-coded, before coding agents</div>
        </div>
        <div>
          <div className="display text-dusk text-2xl leading-none">1,000+</div>
          <div className="mt-1.5 text-xs leading-snug text-[var(--muted)]">agent-assisted, now</div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--line-soft)] pt-5">
        <div className="mono text-[0.78rem] leading-relaxed text-[var(--muted)]">
          1,000 projects × 3 judges × 8 min
          <br />
          <span className="text-[var(--faint)]">before anyone clones a repo</span>
        </div>
        <div className="text-right">
          <div className="display text-3xl leading-none">400</div>
          <div className="mt-1 text-xs text-[var(--muted)]">judge-hours</div>
        </div>
      </div>
    </div>
  );
}

// ── Fatigue: the judge portal's start screen ──────────────────────────────

const QUEUE: { n: string; name: string; score?: number; next?: boolean }[] = [
  { n: "#118", name: "Tidewatch", score: 7.5 },
  { n: "#042", name: "Repo Whisperer", score: 8 },
  { n: "#207", name: "Quiet Hours", score: 6.5 },
  { n: "#033", name: "Pantry Pilot", score: 7 },
  { n: "#251", name: "Signal Garden", next: true },
  { n: "#096", name: "Loom Lens" },
];

export function JudgeQueue() {
  return (
    <div className="mock w-full max-w-lg overflow-hidden text-left">
      <div className="flex items-center gap-3 border-b border-[var(--line-soft)] px-5 py-3">
        <ProjectMark text="AI" size={28} />
        <span className="truncate text-sm font-semibold">Spring Hack Week</span>
        <span className="ml-auto flex items-center gap-2">
          <Meter value={4} max={12} count={12} className="hidden w-20 sm:flex" />
          <span className="display text-xs">4/12</span>
          <Face name="Grace Hopper" i={1} size={26} />
        </span>
      </div>
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-7">
        <div>
          <p className="eyebrow m-0">Group review · round 1 of 2</p>
          <p className="display m-0 mt-2 text-3xl leading-tight">Welcome, Grace</p>
          <p className="m-0 mt-2 text-[0.95rem] text-[var(--muted)]">
            <b className="display font-normal text-[var(--silver)]">4 of 12</b> done today, 8 to go. 36 more open over the coming
            days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="btn-pill btn-pill--dark pointer-events-none !px-5 !py-2 text-sm">
            Keep going
            <PixelIcon name="arrow-right" size={11} />
          </span>
          <span className="text-xs text-[var(--muted)]">About 32 minutes · each score saves when you submit it</span>
        </div>
        <div>
          <p className="m-0 mb-2 text-sm font-semibold">Your projects today</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {QUEUE.map((p) => (
              <li
                key={p.n}
                className={cx(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                  p.next ? "border-[var(--violet)] shadow-[0_0_0_3px_var(--violet-soft)]" : "border-[var(--line-soft)]",
                )}
              >
                <span className="mono w-10 text-xs text-[var(--faint)]">{p.n}</span>
                <span className={cx("min-w-0 flex-1 truncate", p.score === undefined && !p.next && "text-[var(--muted)]")}>{p.name}</span>
                {p.score !== undefined ? (
                  <>
                    <PixelIcon name="check" size={11} className="text-[var(--pass)]" />
                    <span className="display w-7 text-right text-xs">{p.score.toFixed(1)}</span>
                  </>
                ) : p.next ? (
                  <Tag tone="agent">next</Tag>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Hero: host, agent, judges ─────────────────────────────────────────────

function PillarHost() {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="grid size-[22px] place-items-center rounded-md text-[0.6rem] font-bold text-white" style={{ background: "#ff5a1f" }}>
          AH
        </span>
        <span className="text-sm font-semibold">Acme Hacks</span>
      </span>
      <span className="mt-2.5 flex flex-wrap gap-1.5">
        {["Title", "Video", "GitHub"].map((b) => (
          <Tag key={b}>{b}</Tag>
        ))}
      </span>
      <span className="mt-3 inline-flex self-start rounded-lg bg-[var(--screen-deep)] px-2.5 py-1 text-xs font-semibold text-white">
        Submit project
      </span>
    </>
  );
}

const PILLAR_CHECKS: { icon: IconName; text: string; flagged?: boolean }[] = [
  { icon: "gear", text: "Repo builds, tests pass" },
  { icon: "search", text: "Uses an NVIDIA open model" },
  { icon: "globe", text: "Live demo didn't load", flagged: true },
];

function PillarAgent() {
  return (
    <>
      <span className="flex flex-col gap-2">
        {PILLAR_CHECKS.map((c) => (
          <span key={c.text} className="flex items-center gap-2">
            <IconTile icon={c.icon} className="!size-6 !rounded-md" />
            <span className="min-w-0 flex-1 text-xs font-medium">{c.text}</span>
            {c.flagged ? (
              <Tag tone="flag" icon="flag">
                Flagged
              </Tag>
            ) : (
              <Tag tone="pass" icon="check">
                Pass
              </Tag>
            )}
          </span>
        ))}
      </span>
      <Tag tone="flag" icon="flag" className="mt-3 self-start">
        1 flagged for you
      </Tag>
    </>
  );
}

function PillarJudges() {
  return (
    <>
      <span className="flex items-center gap-2">
        <PixelIcon name="trophy" size={13} className="text-[var(--orange)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">1st · Signal Garden</span>
        <span className="flex -space-x-1.5">
          {JUDGES.map((n, i) => (
            <Face key={n} name={n} i={i} size={20} />
          ))}
        </span>
        <span className="display text-base leading-none">8.7</span>
      </span>
      <Tag tone="flag" icon="users" className="mt-3 self-start">
        Ranked by judges
      </Tag>
    </>
  );
}

const PILLARS: { title: string; text: string; visual: ReactNode }[] = [
  {
    title: "You host a hackathon",
    text: "Deploy RoundZero under your brand and write the rubric in your own words. Submissions and scores stay in your own database.",
    visual: <PillarHost />,
  },
  {
    title: "The RoundZero agent keeps judging manageable",
    text: "When judging starts, the agent checks each project's repo and demo against your must-pass rules. Anything it isn't sure about is flagged for you.",
    visual: <PillarAgent />,
  },
  {
    title: "Winners picked for human creativity, not AI token usage",
    text: "Among projects that clear your must-pass rules, your judges' scores set the ranking. The agent's score only breaks ties.",
    visual: <PillarJudges />,
  },
];

export function HeroPillars() {
  return (
    <ol className="mock m-0 mx-auto grid w-full max-w-5xl list-none divide-y divide-[var(--line-soft)] overflow-hidden p-0 text-left md:grid-cols-3 md:divide-x md:divide-y-0">
      {PILLARS.map((p, i) => (
        <li key={p.title} className="relative flex flex-col gap-3 p-6">
          {i === PILLARS.length - 1 ? (
            <span aria-hidden className="absolute inset-x-6 top-0 h-[2px] rounded-full" style={{ background: "var(--dusk)" }} />
          ) : null}
          <span className="display grid size-8 place-items-center rounded-md text-sm text-white" style={{ background: "var(--dusk)" }}>
            {i + 1}
          </span>
          <h2 className="display m-0 text-xl leading-tight text-pretty md:text-lg lg:text-xl">{p.title}</h2>
          <p className="m-0 text-[0.95rem] leading-relaxed text-[var(--muted)]">{p.text}</p>
          <div className="mt-auto flex flex-col rounded-xl bg-[var(--tint)] p-3.5 pt-3">{p.visual}</div>
        </li>
      ))}
    </ol>
  );
}

// ── The split: the ranking judges set ─────────────────────────────────────

const RANKING: { rank: number; name: string; mark: string; judges: number; agent: number; tag?: { tone: Tone; text: string }; out?: boolean }[] = [
  { rank: 1, name: "Signal Garden", mark: "SG", judges: 8.7, agent: 7.2 },
  { rank: 2, name: "Tidewatch", mark: "TW", judges: 8.7, agent: 6.8, tag: { tone: "agent", text: "Tie broken by agent" } },
  { rank: 3, name: "Repo Whisperer", mark: "RW", judges: 8.1, agent: 9.0, tag: { tone: "neutral", text: "Agent's highest" } },
  { rank: 4, name: "Pantry Pilot", mark: "PP", judges: 8.9, agent: 7.4, tag: { tone: "gate", text: "Failed a gate · kept out" }, out: true },
];

export function RankingTable() {
  const top = Math.max(...RANKING.map((r) => r.agent));
  return (
    <div className="mock w-full max-w-xl overflow-hidden text-left">
      <div className="flex items-center gap-2 border-b border-[var(--line-soft)] px-5 py-3.5">
        <span className="text-sm font-semibold">Group review ranking</span>
        <Tag icon="users" className="ml-auto">
          Ranked by judges
        </Tag>
      </div>
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.75rem] gap-x-2 px-4 pt-3 pb-1 text-xs text-[var(--muted)] sm:grid-cols-[2rem_minmax(0,1fr)_3.5rem_3.5rem] sm:gap-x-3 sm:px-5">
        <span>#</span>
        <span>Project</span>
        <span className="text-right">Judges</span>
        <span className="text-right">Agent</span>
      </div>
      <ol className="m-0 list-none divide-y divide-[var(--line-soft)] p-0">
        {RANKING.map((r) => (
          <li
            key={r.name}
            className={cx(
              "grid grid-cols-[1.25rem_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-x-2 gap-y-1.5 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_3.5rem_3.5rem] sm:gap-x-3 sm:px-5",
              r.out && "opacity-60",
            )}
          >
            <span className="display text-lg leading-none">{r.rank}</span>
            <span className="flex min-w-0 items-center gap-2.5">
              {/* The mark gives the name more room on phones by stepping aside. */}
              <span className="hidden sm:contents">
                <ProjectMark text={r.mark} size={28} />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[0.92rem] font-medium">{r.name}</span>
                {r.tag ? (
                  <Tag tone={r.tag.tone} className="max-sm:hidden">
                    {r.tag.text}
                  </Tag>
                ) : null}
              </span>
            </span>
            <span className="display text-right text-lg leading-none">{r.judges.toFixed(1)}</span>
            <span className={cx("text-right text-sm", r.agent === top ? "font-semibold text-[var(--violet)]" : "text-[var(--muted)]")}>
              {r.agent.toFixed(1)}
            </span>
            {/* On phones the name column is too narrow for the tag, so it gets its own row. */}
            {r.tag ? (
              <Tag tone={r.tag.tone} className="col-span-3 col-start-2 justify-self-start sm:hidden">
                {r.tag.text}
              </Tag>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="m-0 border-t border-[var(--line-soft)] bg-[var(--tint)] px-5 py-3 text-xs leading-relaxed text-[var(--muted)]">
        Sorted by the judges&rsquo; average, then the agent&rsquo;s score, then submission order. Gate failures go last.
      </p>
    </div>
  );
}
