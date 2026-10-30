"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { Segmented } from "@/components/controls";
import { LockedNote } from "@/components/locked-note";
import { PixelIcon } from "@/components/pixel-icon";
import { SearchInput, ToolbarSelect } from "@/components/toolbar";
import { Badge, Eyebrow, PageHeader, cn } from "@/components/ui";
import type { IconName, JudgeDirectory, JudgeField, JudgeGroup, JudgeProfile } from "@/lib/data";
import { FieldsDrawer } from "./fields-drawer";
import { GroupDrawer } from "./group-drawer";
import { JudgeDrawer, type JudgeDraft } from "./judge-drawer";
import { JudgePhoto } from "./judge-photo";

type View = "grid" | "list";
type Section = { key: string; label: ReactNode; judges: JudgeProfile[] };
/** Filter value meaning "judges with no value for this field". */
const NONE = "__none__";
const BY_GROUP = "__groups__";

const optionLabel = (f: JudgeField, id: string | undefined) => f.options.find((o) => o.id === id)?.label;

export function JudgesDirectory({
  initial,
  hackathonId,
  slug,
  lock,
}: {
  initial: JudgeDirectory;
  hackathonId: string;
  slug: string;
  /** Once judging starts: judges with reviews, and groups phases use. Neither can be deleted. */
  lock: { reviewed: string[]; phaseGroups: string[] } | null;
}) {
  const [directory, setDirectory] = useState(initial);
  const { judges, fields, groups } = directory;

  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState("");

  const [judgeTarget, setJudgeTarget] = useState<{ draft: JudgeDraft; isNew: boolean } | null>(null);
  const [groupTarget, setGroupTarget] = useState<{ group: JudgeGroup; isNew: boolean } | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);

  // Drop selections that point at deleted groups, fields or options.
  const group = groups.find((g) => g.id === groupId) ?? null;
  const activeFilters = Object.entries(filters).filter(([fieldId, value]) => {
    const f = fields.find((x) => x.id === fieldId);
    return f && (value === NONE || f.options.some((o) => o.id === value));
  });
  const groupByField = fields.find((f) => f.id === groupBy);
  const grouping = groupBy === BY_GROUP ? BY_GROUP : groupByField ? groupBy : "";

  const q = query.trim().toLowerCase();
  const members = group ? new Set(group.members) : null;
  const visible = judges.filter((j) => {
    if (members && !members.has(j.id)) return false;
    for (const [fieldId, value] of activeFilters) {
      if (value === NONE ? fieldId in j.values : j.values[fieldId] !== value) return false;
    }
    if (!q) return true;
    const haystack = [j.name, j.title, j.email, ...fields.map((f) => optionLabel(f, j.values[f.id]) ?? "")];
    return haystack.join(" ").toLowerCase().includes(q);
  });
  const filtering = !!q || activeFilters.length > 0;

  const sections: Section[] = [];
  if (grouping === BY_GROUP) {
    for (const g of groups)
      sections.push({ key: g.id, label: g.name, judges: visible.filter((j) => g.members.includes(j.id)) });
    const grouped = new Set(groups.flatMap((g) => g.members));
    sections.push({ key: NONE, label: "Not in a group", judges: visible.filter((j) => !grouped.has(j.id)) });
  } else if (groupByField) {
    for (const o of groupByField.options) {
      sections.push({ key: o.id, label: o.label, judges: visible.filter((j) => j.values[groupByField.id] === o.id) });
    }
    sections.push({
      key: NONE,
      label: `No ${groupByField.name.toLowerCase()}`,
      judges: visible.filter((j) => !(groupByField.id in j.values)),
    });
  } else {
    sections.push({ key: "all", label: null, judges: visible });
  }

  const shownSections = sections.filter((s) => s.judges.length > 0);

  const groupsOf = (id: string) => groups.filter((g) => g.members.includes(id)).map((g) => g.id);
  const openJudge = (j: JudgeProfile) => setJudgeTarget({ draft: { ...j, groups: groupsOf(j.id) }, isNew: false });
  const newJudge = () =>
    setJudgeTarget({
      isNew: true,
      draft: {
        id: crypto.randomUUID(),
        name: "",
        title: "",
        email: "",
        imagePath: null,
        // Start from whatever's being looked at: the open group and field filters.
        values: Object.fromEntries(activeFilters.filter(([, v]) => v !== NONE)),
        groups: group ? [group.id] : [],
      },
    });
  const newGroup = () =>
    setGroupTarget({
      isNew: true,
      // Starting from a filtered view? Seed the group with what's showing.
      group: { id: crypto.randomUUID(), name: "", members: filtering ? visible.map((j) => j.id) : [] },
    });

  const clearFilters = () => {
    setQuery("");
    setFilters({});
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
      {/* Below lg the sidebar drops under the judges, so the list comes first. */}
      <aside className="order-last flex flex-col gap-8 lg:sticky lg:top-36 lg:order-none lg:self-start">
        <div className="flex flex-col gap-2">
          <Eyebrow>Groups</Eyebrow>
          <nav className="flex flex-col gap-0.5" aria-label="Groups">
            <SideItem icon="users" active={!group} count={judges.length} onClick={() => setGroupId(null)}>
              All judges
            </SideItem>
            {groups.map((g) => (
              <SideItem
                key={g.id}
                icon="tag"
                active={group?.id === g.id}
                count={g.members.length}
                onClick={() => setGroupId(g.id)}
                onEdit={() => setGroupTarget({ group: g, isNew: false })}
              >
                {g.name}
              </SideItem>
            ))}
          </nav>
          <button
            type="button"
            onClick={newGroup}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent-soft-foreground"
          >
            <PixelIcon name="plus" size={10} />
            {filtering && visible.length > 0 ? `Save ${visible.length} as group` : "New group"}
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <Eyebrow>Fields</Eyebrow>
            {fields.length > 0 && (
              <button
                type="button"
                onClick={() => setFieldsOpen(true)}
                className="text-sm text-muted underline decoration-border-secondary underline-offset-4 hover:text-foreground"
              >
                Edit
              </button>
            )}
          </div>
          {fields.length === 0 ? (
            <>
              <p className="text-sm text-muted">
                Reusable fields like Company or Track, to filter and group judges by.
              </p>
              <Button size="sm" variant="secondary" onPress={() => setFieldsOpen(true)}>
                <PixelIcon name="plus" size={10} />
                Add a field
              </Button>
            </>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {fields.map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-2 px-1">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 font-pixel text-xs text-muted">{f.options.length}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="min-w-0">
        <PageHeader
          eyebrow={group ? "Group" : undefined}
          title={group ? group.name : "Judges"}
          actions={
            <>
              {group && (
                <Button variant="secondary" onPress={() => setGroupTarget({ group, isNew: false })}>
                  Edit group
                </Button>
              )}
              <Button onPress={newJudge}>
                <PixelIcon name="plus" size={12} />
                Add judge
              </Button>
            </>
          }
        />
        {lock && (
          <div className="mb-6">
            <LockedNote>
              Judging has started, so judges with reviews and groups that phases use can&apos;t be deleted. You can
              still add judges and edit their details.
            </LockedNote>
          </div>
        )}

        {judges.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search judges…" />

            {fields.map((f) => {
              const value = activeFilters.find(([id]) => id === f.id)?.[1] ?? "";
              return (
                <ToolbarSelect
                  key={f.id}
                  label={f.name}
                  value={value}
                  active={!!value}
                  onChange={(v) => setFilters((fs) => ({ ...fs, [f.id]: v }))}
                  options={[
                    { value: "", label: `${f.name}: any` },
                    ...f.options.map((o) => ({ value: o.id, label: o.label })),
                    { value: NONE, label: `No ${f.name.toLowerCase()}` },
                  ]}
                />
              );
            })}

            {filtering && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-1 text-sm text-muted underline decoration-border-secondary underline-offset-4 hover:text-foreground"
              >
                Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <ToolbarSelect
                label="Group by"
                value={grouping}
                active={!!grouping}
                onChange={setGroupBy}
                options={[
                  { value: "", label: "No grouping" },
                  ...fields.map((f) => ({ value: f.id, label: `By ${f.name.toLowerCase()}` })),
                  ...(groups.length ? [{ value: BY_GROUP, label: "By group" }] : []),
                ]}
              />
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  {
                    value: "grid",
                    label: (
                      <>
                        <PixelIcon name="grid" size={14} />
                        Grid
                      </>
                    ),
                  },
                  {
                    value: "list",
                    label: (
                      <>
                        <PixelIcon name="list" size={14} />
                        List
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}

        {judges.length === 0 ? (
          <EmptyState onAdd={newJudge} />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-14 text-center">
            <p className="text-muted">
              {group && group.members.length === 0 ? "No one's in this group yet." : "No judges match."}
            </p>
            {group && group.members.length === 0 ? (
              <Button size="sm" variant="secondary" onPress={() => setGroupTarget({ group, isNew: false })}>
                Add judges to group
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onPress={clearFilters}>
                Clear search &amp; filters
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {view === "list" ? (
              <JudgeTable sections={shownSections} fields={fields} groups={groups} onOpen={openJudge} />
            ) : (
              shownSections.map((s) => (
                <div key={s.key} className="flex flex-col gap-3">
                  {s.label && (
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-lg leading-none">{s.label}</h2>
                      <span className="font-pixel text-xs text-muted">{s.judges.length}</span>
                    </div>
                  )}
                  <JudgeGrid judges={s.judges} fields={fields} onOpen={openJudge} />
                </div>
              ))
            )}
            <p className="font-pixel text-xs text-muted">
              {visible.length === judges.length ? "" : `${visible.length} of `}
              {judges.length} {judges.length === 1 ? "judge" : "judges"}
            </p>
          </div>
        )}
      </section>

      <JudgeDrawer
        target={judgeTarget?.draft ?? null}
        isNew={!!judgeTarget?.isNew}
        fields={fields}
        groups={groups}
        hackathonId={hackathonId}
        slug={slug}
        reviewed={lock?.reviewed ?? []}
        onClose={() => setJudgeTarget(null)}
        onSaved={setDirectory}
      />
      <GroupDrawer
        target={groupTarget?.group ?? null}
        isNew={!!groupTarget?.isNew}
        judges={judges}
        fields={fields}
        slug={slug}
        inUse={lock?.phaseGroups ?? []}
        onClose={() => setGroupTarget(null)}
        onSaved={(d, id) => {
          setDirectory(d);
          // Show a group once it's created; step out of one once it's deleted.
          if (id && groupTarget?.isNew) setGroupId(id);
          if (!id) setGroupId(null);
        }}
      />
      <FieldsDrawer
        isOpen={fieldsOpen}
        fields={fields}
        judges={judges}
        slug={slug}
        onClose={() => setFieldsOpen(false)}
        onSaved={setDirectory}
      />
    </div>
  );
}

function SideItem({
  icon,
  active,
  count,
  onClick,
  onEdit,
  children,
}: {
  icon: IconName;
  active: boolean;
  count: number;
  onClick: () => void;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-lg transition",
        active
          ? "bg-surface-secondary text-foreground"
          : "text-muted hover:bg-surface-secondary/60 hover:text-foreground",
      )}
    >
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-semibold"
      >
        <PixelIcon name={icon} size={12} className={active ? "text-accent" : undefined} />
        <span className="truncate">{children}</span>
        <span className="ml-auto font-pixel text-xs text-muted">{count}</span>
      </button>
      {onEdit && (
        <button
          type="button"
          aria-label={typeof children === "string" ? `Edit ${children}` : "Edit group"}
          onClick={onEdit}
          className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface-tertiary hover:text-foreground focus-visible:opacity-100"
        >
          <PixelIcon name="gear" size={12} />
        </button>
      )}
    </div>
  );
}

function FieldBadges({ judge, fields, className }: { judge: JudgeProfile; fields: JudgeField[]; className?: string }) {
  const labels = fields.map((f) => optionLabel(f, judge.values[f.id])).filter(Boolean);
  if (!labels.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {labels.map((l) => (
        <Badge key={l}>{l}</Badge>
      ))}
    </div>
  );
}

function JudgeGrid({
  judges,
  fields,
  onOpen,
}: {
  judges: JudgeProfile[];
  fields: JudgeField[];
  onOpen: (j: JudgeProfile) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {judges.map((j) => (
        <li key={j.id}>
          <button
            type="button"
            onClick={() => onOpen(j)}
            className="flex h-full w-full flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface px-4 pt-5 pb-4 text-center shadow-block transition hover:-translate-y-px hover:border-accent"
          >
            <JudgePhoto name={j.name} imagePath={j.imagePath} size={80} className="rounded-lg" />
            <span className="flex w-full min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold">{j.name}</span>
              <span className="truncate text-sm text-muted">{j.title || " "}</span>
            </span>
            <FieldBadges judge={j} fields={fields} className="justify-center" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One table for every section, so columns line up; each section gets a header row. */
function JudgeTable({
  sections,
  fields,
  groups,
  onOpen,
}: {
  sections: Section[];
  fields: JudgeField[];
  groups: JudgeGroup[];
  onOpen: (j: JudgeProfile) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border text-left">
            <Th>Judge</Th>
            <Th>Email</Th>
            {fields.map((f) => (
              <Th key={f.id}>{f.name}</Th>
            ))}
            <Th>Groups</Th>
          </tr>
        </thead>
        {sections.map((s) => (
          <tbody key={s.key} className="divide-y divide-border">
            {s.label && (
              <tr className="bg-surface-secondary/60">
                <td colSpan={fields.length + 3} className="px-4 py-2">
                  <span className="font-semibold">{s.label}</span>
                  <span className="ml-2 font-pixel text-xs text-muted">{s.judges.length}</span>
                </td>
              </tr>
            )}
            {s.judges.map((j) => {
              const inGroups = groups.filter((g) => g.members.includes(j.id));
              return (
                <tr
                  key={j.id}
                  onClick={() => onOpen(j)}
                  className="cursor-pointer transition hover:bg-surface-secondary/60"
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(j);
                      }}
                      className="flex items-center gap-3 text-left"
                    >
                      <JudgePhoto name={j.name} imagePath={j.imagePath} size={32} />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium whitespace-nowrap">{j.name}</span>
                        {j.title && <span className="text-xs whitespace-nowrap text-muted">{j.title}</span>}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{j.email || "—"}</td>
                  {fields.map((f) => (
                    <td key={f.id} className="px-4 py-2.5 whitespace-nowrap">
                      {optionLabel(f, j.values[f.id]) ?? <span className="text-muted">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {inGroups.length ? (
                        inGroups.map((g) => <Badge key={g.id}>{g.name}</Badge>)
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-pixel text-xs font-normal tracking-wide whitespace-nowrap text-muted uppercase">
      {children}
    </th>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <PixelIcon name="users" size={24} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-xl">No judges yet</h2>
        <p className="text-sm text-muted">
          Add each judge with a name, title, email and photo. Custom fields like Company let you filter and group them.
        </p>
      </div>
      <Button onPress={onAdd}>
        <PixelIcon name="plus" size={12} />
        Add your first judge
      </Button>
    </div>
  );
}
