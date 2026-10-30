"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { IntentLink } from "@/components/intent-link";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { SearchInput, ToolbarSelect } from "@/components/toolbar";
import { Badge, PageHeader, cn } from "@/components/ui";
import type { JudgingPhase, ProjectRecord, ProjectStatus, SchemaBlock } from "@/lib/data";
import { moveProjects } from "@/lib/judging-actions";
import { formatNumber, hasValue, projectHeadline, valueText } from "@/lib/project-fields";
import type { IntakeSettings } from "@/lib/intake";
import { SampleDataButton } from "../progress/progress-actions";
import { IntakeButtons } from "./intake-drawers";
import { ProjectDrawer, type ProjectDraft } from "./project-drawer";
import { STATUS, StatusBadge } from "./status-badge";

/** Filter value meaning "projects not in any phase". */
const NONE = "__none__";
type Sort = "newest" | "oldest" | "name" | "updated" | "score";

/** A project's headline score: the judges' average, or the agent's until judges score. */
export type ProjectScore = { value: number; source: "judges" | "agent" };

export function ProjectsList({
  projects,
  blocks,
  phases,
  scores,
  slug,
  intake,
}: {
  projects: ProjectRecord[];
  blocks: SchemaBlock[];
  phases: JudgingPhase[];
  scores: Record<string, ProjectScore>;
  slug: string;
  intake: { settings: IntakeSettings; origin: string; hackathonName: string; judgingStarted: boolean };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [phase, setPhase] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<ProjectDraft | null>(null);
  const [error, setError] = useState<string>();
  const [moving, startMove] = useTransition();

  const phaseName = (id: string | null) => phases.find((p) => p.id === id)?.name;
  const rows = projects.map((p) => ({ project: p, ...projectHeadline(p, blocks) }));

  const q = query.trim().toLowerCase();
  const visible = rows
    .filter(({ project: p, name }) => {
      if (status && p.status !== status) return false;
      if (phase === NONE ? p.phaseId !== null : phase && p.phaseId !== phase) return false;
      if (!q) return true;
      const haystack = [formatNumber(p.number), name, ...Object.values(p.values).map(valueText)];
      return haystack.join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "oldest") return a.project.number - b.project.number;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "score")
        return (scores[b.project.id]?.value ?? -1) - (scores[a.project.id]?.value ?? -1) || a.project.number - b.project.number;
      if (sort === "updated") return b.project.updatedAt.localeCompare(a.project.updatedAt);
      return b.project.number - a.project.number;
    });
  const filtering = !!q || !!status || !!phase;

  // Only act on what's still visible, so a filter change can't move hidden rows.
  const picked = visible.filter((r) => selected.has(r.project.id)).map((r) => r.project.id);
  const allPicked = visible.length > 0 && picked.length === visible.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const move = (phaseId: string) =>
    startMove(async () => {
      setError(undefined);
      const result = await moveProjects(slug, picked, phaseId === NONE ? null : phaseId);
      if ("error" in result) return setError(result.error);
      setSelected(new Set());
    });

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setPhase("");
  };
  const newProject = () => setAdding({ id: crypto.randomUUID(), values: {}, contactEmail: "" });

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Projects"
        actions={
          <>
            <IntakeButtons slug={slug} blocks={blocks} {...intake} />
            <Button onPress={newProject} isDisabled={blocks.length === 0}>
              <PixelIcon name="plus" size={12} />
              Add project
            </Button>
          </>
        }
      />
      <SaveError error={error} />

      {projects.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects…" />
          <ToolbarSelect
            label="Status"
            value={status}
            active={!!status}
            onChange={(v) => setStatus(v as ProjectStatus | "")}
            options={[
              { value: "", label: "Status: any" },
              ...(Object.keys(STATUS) as ProjectStatus[]).map((s) => ({ value: s, label: STATUS[s].label })),
            ]}
          />
          <ToolbarSelect
            label="Phase"
            value={phase}
            active={!!phase}
            onChange={setPhase}
            options={[
              { value: "", label: "Phase: any" },
              ...phases.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.name}` })),
              { value: NONE, label: "Not in a phase" },
            ]}
          />
          {filtering && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-1 text-sm text-muted underline decoration-border-secondary underline-offset-4 hover:text-foreground"
            >
              Clear
            </button>
          )}
          <div className="ml-auto">
            <ToolbarSelect
              label="Sort"
              value={sort}
              active={false}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "updated", label: "Recently updated" },
                { value: "score", label: "Highest score" },
                { value: "name", label: "Name A–Z" },
              ]}
            />
          </div>
        </div>
      )}

      {picked.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-accent-soft px-4 py-2 text-sm text-accent-soft-foreground">
          <span className="font-semibold">{picked.length} selected</span>
          <ToolbarSelect
            label="Move to phase"
            value=""
            active
            onChange={(v) => v && move(v)}
            options={[
              { value: "", label: moving ? "Moving…" : "Move to phase…" },
              ...phases.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.name}` })),
              { value: NONE, label: "Out of judging" },
            ]}
          />
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto underline underline-offset-4">
            Clear selection
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState onAdd={newProject} hasSchema={blocks.length > 0} slug={slug} />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-14 text-center">
          <p className="text-muted">No projects match.</p>
          <Button size="sm" variant="secondary" onPress={clearFilters}>
            Clear search &amp; filters
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border-2 border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="w-10 py-2.5 pl-4">
                    <Checkbox
                      checked={allPicked}
                      label="Select all"
                      onChange={() =>
                        setSelected(allPicked ? new Set() : new Set(visible.map((r) => r.project.id)))
                      }
                    />
                  </th>
                  <Th className="w-16">#</Th>
                  <Th>Project</Th>
                  <Th>Phase</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Fields</Th>
                  <Th className="text-right">Score</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(({ project: p, name, pitch }) => {
                  const href = `/h/${slug}/judging/projects/${p.number}`;
                  const filled = blocks.filter((b) => hasValue(p.values[b.id])).length;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(href)}
                      className={cn(
                        "cursor-pointer transition hover:bg-surface-secondary/60",
                        selected.has(p.id) && "bg-accent-soft/40",
                      )}
                    >
                      <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(p.id)} label={`Select ${name}`} onChange={() => toggle(p.id)} />
                      </td>
                      <td className="px-4 py-3 font-pixel text-muted">{formatNumber(p.number)}</td>
                      <td className="max-w-md px-4 py-3">
                        <IntentLink href={href} className="flex min-w-0 flex-col" onClick={(e) => e.stopPropagation()}>
                          <span className={cn("truncate font-medium", p.status !== "active" && "text-muted")}>
                            {name}
                          </span>
                          {pitch && <span className="truncate text-xs text-muted">{pitch}</span>}
                        </IntentLink>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {phaseName(p.phaseId) ? (
                          <Badge>{phaseName(p.phaseId)}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-pixel text-xs whitespace-nowrap">
                        <span className={filled < blocks.length ? "text-warning-soft-foreground" : "text-muted"}>
                          {filled}/{blocks.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-pixel whitespace-nowrap">
                        <ScoreCell score={scores[p.id]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-pixel text-xs text-muted">
            {visible.length === projects.length ? "" : `${visible.length} of `}
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </>
      )}

      <ProjectDrawer
        target={adding}
        isNew
        blocks={blocks}
        slug={slug}
        onClose={() => setAdding(null)}
        onSaved={(number) => router.push(`/h/${slug}/judging/projects/${number}`)}
      />
    </div>
  );
}

function ScoreCell({ score }: { score?: ProjectScore }) {
  if (!score) return <span className="text-muted">–</span>;
  if (score.source === "judges") return <>{score.value.toFixed(1)}</>;
  return (
    <span className="inline-flex items-center gap-1.5" title="Agent score — no judge scores yet">
      <PixelIcon name="spark" size={10} className="text-accent" />
      {score.value.toFixed(1)}
    </span>
  );
}

/** Picks projects to move between phases, so it's off in read-only views. */
function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  const readOnly = useReadOnly();
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      disabled={readOnly}
      onChange={onChange}
      className="size-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 font-pixel text-xs font-normal tracking-wide whitespace-nowrap text-muted uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

function EmptyState({ onAdd, hasSchema, slug }: { onAdd: () => void; hasSchema: boolean; slug: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <PixelIcon name="table" size={24} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-xl">No projects yet</h2>
        <p className="text-sm text-muted">
          {hasSchema
            ? "Add projects by hand for now. The form follows your project schema, one field per block."
            : "Set up the project schema first, so there's a form to fill in."}
        </p>
      </div>
      {hasSchema ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onPress={onAdd}>
            <PixelIcon name="plus" size={12} />
            Add your first project
          </Button>
          <SampleDataButton slug={slug} />
        </div>
      ) : (
        <Link href={`/h/${slug}/setup/schema`} className="underline underline-offset-4">
          Go to Setup › Schema
        </Link>
      )}
    </div>
  );
}
