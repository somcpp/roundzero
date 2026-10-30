"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { TextArea, Toggle } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { AddTile, Avatar, Badge, Eyebrow, PageHeader, Panel, cn } from "@/components/ui";
import type { Rule } from "@/lib/data";

const TABS = [
  { id: "disagreement", label: "From disagreements", n: 6 },
  { id: "admin", label: "Written by admins", n: 4 },
  { id: "past", label: "From past hackathons", n: 13 },
] as const;

// Deterministic "agent × human" points for the calibration plot.
const POINTS = Array.from({ length: 40 }, (_, i) => {
  const human = 3 + ((i * 37) % 60) / 10;
  const drift = ((i * 53) % 17) / 10 - 0.5 + (i % 4 === 0 ? 1.2 : 0);
  return { human, agent: Math.min(10, Math.max(1, human + drift)) };
});

export function AgentNotes({ initial, slug }: { initial: Rule[]; slug: string }) {
  const [rules, setRules] = useState(initial);
  const [tab, setTab] = useState<Rule["source"] | "all">("all");
  const [editing, setEditing] = useState(false);
  const [applyHere, setApplyHere] = useState(true);
  const [applyOrg, setApplyOrg] = useState(true);
  const [rescore, setRescore] = useState(false);

  const visible = rules.filter((r) => tab === "all" || r.source === tab);
  const setRule = (id: string, patch: Partial<Rule>) => setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col">
        <PageHeader
          eyebrow="Judging · Agent notes"
          title="Judging notes & rules"
          hint="The agent reads these before scoring. Human disagreements become rules for later phases and future hackathons."
        />

        <div className="mb-6 flex flex-wrap gap-2">
          <Chip2 active={tab === "all"} onClick={() => setTab("all")}>
            All
          </Chip2>
          {TABS.map((t) => (
            <Chip2 key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label} <span className="font-pixel text-[11px] opacity-60">{t.n}</span>
            </Chip2>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {visible.map((r) =>
            r.state === "proposed" ? (
              <Panel key={r.id} className="flex flex-col gap-4 border-warning/50 p-6">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge tone="warning">
                    <PixelIcon name="flag" size={10} /> disagreement
                  </Badge>
                  <Avatar name="Marcus O." size={22} />
                  <span>{r.who}</span>
                  <span className="ml-auto text-xs text-muted">{r.when}</span>
                </div>
                <blockquote className="border-l-2 border-border-secondary pl-3 text-sm">“{r.quote}”</blockquote>
                <div className="flex flex-col gap-2 rounded-lg bg-accent-soft p-4">
                  <Eyebrow className="text-accent-soft-foreground">Proposed rule · {r.meta}</Eyebrow>
                  {editing ? (
                    <TextArea rows={3} value={r.title} onChange={(e) => setRule(r.id, { title: e.target.value })} autoFocus />
                  ) : (
                    <p className="text-sm text-foreground">{r.title}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onPress={() => {
                      setRule(r.id, { state: "active", meta: "from Marcus O. disagreement · #047 · applies: this hackathon + future" });
                      setEditing(false);
                    }}
                  >
                    <PixelIcon name="check" size={10} /> Accept rule
                  </Button>
                  <Button size="sm" variant="secondary" onPress={() => setEditing((v) => !v)}>
                    {editing ? "Done" : "Edit"}
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    title="Dismiss this proposed rule?"
                    description="The agent won't apply it, and it's removed from the list."
                    confirmLabel="Dismiss rule"
                    onConfirm={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}
                  >
                    Dismiss
                  </ConfirmButton>
                  <span className="ml-auto text-xs text-muted">
                    affects {r.affects} other projects →{" "}
                    <button type="button" className="text-foreground underline underline-offset-4">
                      re-evaluate?
                    </button>
                  </span>
                </div>
              </Panel>
            ) : (
              <Panel key={r.id} className="flex items-start gap-4 p-5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-success-soft text-success-soft-foreground">
                  <PixelIcon name="check" size={10} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm">{r.title}</span>
                  <span className="text-xs text-muted">{r.meta}</span>
                </div>
                <Badge tone="success">active</Badge>
              </Panel>
            ),
          )}
          <AddTile>write a rule</AddTile>
        </div>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-36 lg:self-start">
        <div className="text-right text-xs text-muted">
          org library: <span className="font-pixel text-foreground">23</span> rules from 3 hackathons
        </div>

        <Panel className="flex flex-col gap-4 p-5">
          <h2 className="text-base leading-none">Agent calibration</h2>
          <Eyebrow>Agent vs judges (phase 1)</Eyebrow>
          <svg viewBox="0 0 110 110" className="pixelated w-full rounded-md bg-surface-secondary/60">
            <line x1="5" y1="105" x2="105" y2="5" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-border-tertiary" />
            {POINTS.map((p, i) => (
              <rect key={i} x={p.human * 10} y={105 - p.agent * 10} width="3" height="3" className={cn(p.agent - p.human > 1 ? "fill-warning" : "fill-accent")} />
            ))}
            <text x="6" y="10" className="fill-muted font-mono text-[5px]">agent ↑</text>
            <text x="82" y="103" className="fill-muted font-mono text-[5px]">human →</text>
          </svg>
          <p className="text-sm">
            agreement <b className="font-pixel">±0.8</b> avg · <span className="text-warning-soft-foreground">drifts high on Technical</span>
          </p>
        </Panel>

        <Panel className="flex flex-col gap-4 p-5">
          <Eyebrow>Apply rules to</Eyebrow>
          <Toggle checked={applyHere} onChange={setApplyHere} label="Next phases here" />
          <Toggle checked={applyOrg} onChange={setApplyOrg} label="Org library" description="Future hackathons" />
          <Toggle checked={rescore} onChange={setRescore} label="Re-score phase 1 now" />
        </Panel>

        <Button fullWidth>
          Re-evaluate 20 finalists with rules <PixelIcon name="arrow-right" size={12} />
        </Button>
        <p className="text-xs text-muted">
          Creates a new “Agent re-scored” entry in each{" "}
          <Link href={`/h/${slug}/judging/projects/47`} className="underline underline-offset-4">
            audit trail
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}

function Chip2({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
