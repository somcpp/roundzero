import type { ReactNode } from "react";
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, Eyebrow, Panel, cn } from "@/components/ui";
import type { JudgePortalSettings, Scale } from "@/lib/data";

// The start and finish screens on a judge's link (/j/<token>). Plain
// components with no data fetching, so Setup › Judge portal can preview them
// with the organizer's copy as it's typed.

/** Rough minutes a judge spends per project, as the distribution preview estimates. */
const MINUTES_PER_PROJECT = 4;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The start screen's headline: the organizer's, with {name} filled in, or a greeting. */
export const welcomeHeadline = (title: string, firstName: string) =>
  title.trim() ? title.replace(/\{name\}/g, firstName) : `Welcome, ${firstName}`;

export type ScreenProject = { id: string; name: string; done: boolean; score: number | null; href: string | null };

export type ScreenCriterion = { id: string; title: string; description: string; scale: Scale; weight: number; gate: boolean };

/** Before a judge starts (or when they come back): what's waiting, the goal, and how they'll score. */
export function StartScreen({
  firstName,
  settings,
  phaseLabel,
  daily,
  projects,
  later,
  criteria,
  cta,
}: {
  firstName: string;
  settings: JudgePortalSettings;
  /** e.g. "Group review · round 1 of 2". */
  phaseLabel: string;
  /** Work goes out in daily batches. */
  daily: boolean;
  /** What's open to score now, in queue order. */
  projects: ScreenProject[];
  /** Projects in batches that haven't opened yet. */
  later: number;
  criteria: ScreenCriterion[];
  /** The start button. */
  cta: ReactNode;
}) {
  const done = projects.filter((p) => p.done).length;
  const todo = projects.length - done;
  const today = daily ? " today" : "";
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Eyebrow>{phaseLabel}</Eyebrow>
        <h1 className="text-4xl leading-tight sm:text-5xl">{welcomeHeadline(settings.welcomeTitle, firstName)}</h1>
        <p className="text-lg text-muted">
          {done === 0 ? (
            <>
              You have <b className="font-pixel text-foreground">{plural(projects.length, "project")}</b> to judge{today}.
            </>
          ) : (
            <>
              <b className="font-pixel text-foreground">
                {done} of {projects.length}
              </b>{" "}
              done{today}, {todo} to go.
            </>
          )}
          {later > 0 && ` ${plural(later, "more opens", "more open")} over the coming days.`}
        </p>
        {settings.welcomeMessage && <p className="text-[17px] leading-relaxed whitespace-pre-wrap">{settings.welcomeMessage}</p>}
      </div>

      {settings.goals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg leading-none">Remember the goal</h2>
          <ul className="flex flex-col gap-2.5">
            {settings.goals.map((g, i) => (
              <li key={`${i}-${g}`} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-foreground">
                  <PixelIcon name="flag" size={12} />
                </span>
                <span className="pt-0.5 text-[15px]">{g}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {cta}
        <span className="text-sm text-muted">
          About {Math.max(1, todo) * MINUTES_PER_PROJECT} minutes · each score saves when you submit it
        </span>
      </div>

      {criteria.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg leading-none">What you&apos;ll score</h2>
            <span className="text-sm text-muted">on every project</span>
          </div>
          <Panel className="divide-y divide-border">
            {criteria.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 px-5 py-3.5">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="font-medium">{c.title}</span>
                  <span className="font-pixel text-xs text-muted">{c.weight}%</span>
                  {c.scale === "pass_fail" && <Badge>pass / fail</Badge>}
                  {c.gate && <Badge tone="warning">must pass</Badge>}
                </div>
                {c.description && <p className="text-sm text-muted">{c.description}</p>}
              </div>
            ))}
          </Panel>
        </section>
      )}

      {projects.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg leading-none">Your projects{today}</h2>
          <ProjectList projects={projects} />
        </section>
      )}
    </div>
  );
}

/** When everything open is scored: thanks, and more if there's more. */
export function DoneScreen({
  firstName,
  message,
  phaseName,
  projects,
  later,
  more,
}: {
  firstName: string;
  /** The organizer's finish message. */
  message: string;
  phaseName: string;
  projects: ScreenProject[];
  /** Projects in batches that haven't opened yet. */
  later: number;
  /** What to offer when there are later batches: the next one's time and a "judge more" button. */
  more?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="lip grid size-16 place-items-center rounded-2xl bg-success text-white">
          <PixelIcon name="check" size={28} />
        </span>
        <h1 className="text-4xl leading-tight sm:text-5xl">{later > 0 ? "All done for today" : "All done!"}</h1>
        <p className="text-lg text-muted">
          You scored {plural(projects.length, "project")}
          {later > 0 ? " today" : ` in ${phaseName}`}. Thank you, {firstName}!
        </p>
        {message && <p className="max-w-xl text-[17px] leading-relaxed whitespace-pre-wrap">{message}</p>}
      </div>

      {later > 0 ? (
        more
      ) : (
        <p className="rounded-xl border-2 border-dashed border-border px-5 py-4 text-center text-sm text-muted">
          That&apos;s everything in your queue for {phaseName}. You can still change a score until the organizers close
          this round.
        </p>
      )}

      {projects.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg leading-none">Your scores</h2>
          <ProjectList projects={projects} />
        </section>
      )}
    </div>
  );
}

function ProjectList({ projects }: { projects: ScreenProject[] }) {
  return (
    <Panel className="divide-y divide-border">
      {projects.map((p, i) => {
        const body = (
          <>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-md font-pixel text-xs",
                p.done ? "bg-success-soft text-success-soft-foreground" : "bg-surface-secondary text-muted",
              )}
            >
              {p.done ? <PixelIcon name="check" size={12} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {p.score !== null && <span className="font-pixel text-sm">{p.score.toFixed(1)}</span>}
            {p.href && <PixelIcon name="arrow-right" size={10} className="text-muted" />}
          </>
        );
        return p.href ? (
          <Link key={p.id} href={p.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-secondary/60">
            {body}
          </Link>
        ) : (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            {body}
          </div>
        );
      })}
    </Panel>
  );
}
