"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Section, Demo } from "../demo";
import {
  Accordion,
  Alert,
  AlertDialog,
  Breadcrumbs,
  Button,
  Chip,
  CloseButton,
  Description,
  Disclosure,
  DisclosureGroup,
  Drawer,
  Dropdown,
  Header,
  Kbd,
  Label,
  Menu,
  Meter,
  Modal,
  Pagination,
  Popover,
  ProgressBar,
  ProgressCircle,
  Separator,
  Spinner,
  Table,
  Tabs,
  Tag,
  TagGroup,
  Toast,
  toast,
} from "@heroui/react";
import type { Key, SortDescriptor } from "@heroui/react";

export const id = "overlays";
export const title = "Overlays, navigation & feedback";
export const components = [
  "Modal",
  "AlertDialog",
  "Drawer",
  "Popover",
  "Dropdown",
  "Menu",
  "Accordion",
  "Disclosure",
  "DisclosureGroup",
  "Tabs",
  "Breadcrumbs",
  "Pagination",
  "Table",
  "TagGroup",
  "Alert",
  "Toast",
  "ProgressBar",
  "ProgressCircle",
  "Meter",
];

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const STATUSES = ["default", "accent", "success", "warning", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;

function Trophy({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" strokeLinejoin="round" />
    </svg>
  );
}

/** Small caption above a group of variants. */
function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <div className={className ?? "flex flex-wrap items-center gap-3"}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

type ModalSize = "xs" | "sm" | "md" | "lg" | "cover" | "full";
type Backdrop = "opaque" | "blur" | "transparent";
type ModalPlacement = "auto" | "center" | "top" | "bottom";

function JudgeModal({
  trigger,
  size = "md",
  backdrop = "opaque",
  placement = "auto",
  scroll = "inside",
  long = false,
}: {
  trigger: string;
  size?: ModalSize;
  backdrop?: Backdrop;
  placement?: ModalPlacement;
  scroll?: "inside" | "outside";
  long?: boolean;
}) {
  return (
    <Modal>
      <Button variant="secondary" size="sm">
        {trigger}
      </Button>
      <Modal.Backdrop variant={backdrop}>
        <Modal.Container size={size} placement={placement} scroll={scroll}>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <Trophy />
              </Modal.Icon>
              <Modal.Heading>Publish winners</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted">
                Judges have scored all 42 submissions for <strong>Nebius AI Hack 2026</strong>. Publishing
                will email every team and make the leaderboard public.
              </p>
              {long &&
                Array.from({ length: 12 }, (_, i) => (
                  <p key={i} className="mt-3 text-sm">
                    #{i + 1} — Team {["Atlas", "Orbit", "Quill", "Nova", "Lumen", "Delta"][i % 6]} ·{" "}
                    {(92 - i * 1.7).toFixed(1)} pts
                  </p>
                ))}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="tertiary">
                Not yet
              </Button>
              <Button slot="close">Publish</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* AlertDialog                                                         */
/* ------------------------------------------------------------------ */

const ALERT_DIALOGS = [
  {
    status: "default",
    trigger: "Default",
    heading: "Reassign this submission?",
    body: "Team Orbit will be moved from Priya's queue to Marcus's queue.",
    confirm: "Reassign",
  },
  {
    status: "accent",
    trigger: "Accent",
    heading: "Open judging?",
    body: "All 12 judges will be notified and can start scoring immediately.",
    confirm: "Open judging",
  },
  {
    status: "success",
    trigger: "Success",
    heading: "Publish winners?",
    body: "The leaderboard becomes public and every team gets an email.",
    confirm: "Publish",
  },
  {
    status: "warning",
    trigger: "Warning",
    heading: "Close submissions early?",
    body: "3 teams still have drafts in progress. They won't be able to submit.",
    confirm: "Close anyway",
  },
  {
    status: "danger",
    trigger: "Danger",
    heading: "Delete hackathon?",
    body: "This permanently deletes Nebius AI Hack 2026, its 42 submissions and all scores. This cannot be undone.",
    confirm: "Delete hackathon",
  },
] as const;

function JudgeAlertDialog({
  trigger,
  status,
  heading,
  body,
  confirm,
  size = "md",
  triggerVariant = "secondary",
}: {
  trigger: string;
  status: (typeof STATUSES)[number];
  heading: string;
  body: string;
  confirm: string;
  size?: "xs" | "sm" | "md" | "lg" | "cover";
  triggerVariant?: "secondary" | "danger-soft";
}) {
  return (
    <AlertDialog>
      <Button variant={triggerVariant} size="sm">
        {trigger}
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container size={size}>
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status={status} />
              <AlertDialog.Heading>{heading}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{body}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button slot="close" variant={status === "danger" ? "danger" : "primary"}>
                {confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

function JudgeDrawer({
  placement,
  backdrop = "opaque",
  trigger,
}: {
  placement: "top" | "bottom" | "left" | "right";
  backdrop?: Backdrop;
  trigger: string;
}) {
  return (
    <Drawer>
      <Button variant="secondary" size="sm">
        {trigger}
      </Button>
      <Drawer.Backdrop variant={backdrop}>
        <Drawer.Content placement={placement}>
          <Drawer.Dialog>
            {placement === "bottom" && <Drawer.Handle />}
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Team Orbit — “Agentic Code Reviewer”</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <p className="text-sm text-muted">
                Submission details slide in from the <strong>{placement}</strong>. Score it against the rubric
                without leaving the queue.
              </p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Skip
              </Button>
              <Button slot="close">Start scoring</Button>
            </Drawer.Footer>
            {placement === "top" && <Drawer.Handle />}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function PaginationDemo({ size, total = 10 }: { size: (typeof SIZES)[number]; total?: number }) {
  const [page, setPage] = useState(1);
  const pages: (number | "gap-l" | "gap-r")[] = useMemo(() => {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | "gap-l" | "gap-r")[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    if (start > 2) out.push("gap-l");
    for (let p = start; p <= end; p++) out.push(p);
    if (end < total - 1) out.push("gap-r");
    out.push(total);
    return out;
  }, [page, total]);

  return (
    <Pagination size={size} className="w-full justify-between">
      <Pagination.Summary>
        Page {page} of {total} · {total * 10} submissions
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page === 1} onPress={() => setPage((p) => p - 1)}>
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pages.map((p) =>
          typeof p === "number" ? (
            <Pagination.Item key={p}>
              <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={page === total} onPress={() => setPage((p) => p + 1)}>
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

const JUDGES = [
  { id: "priya", name: "Priya Raman", role: "Lead judge", scored: 42, total: 42, status: "done" },
  { id: "marcus", name: "Marcus Chen", role: "Technical", scored: 31, total: 42, status: "active" },
  { id: "sofia", name: "Sofía Alvarez", role: "Design", scored: 18, total: 42, status: "active" },
  { id: "tom", name: "Tom Okafor", role: "Sponsor (Nebius)", scored: 4, total: 42, status: "behind" },
  { id: "lena", name: "Lena Fischer", role: "Technical", scored: 0, total: 42, status: "invited" },
] as const;

const STATUS_CHIP = {
  done: { color: "success", label: "Done" },
  active: { color: "accent", label: "Scoring" },
  behind: { color: "warning", label: "Behind" },
  invited: { color: "default", label: "Invited" },
} as const;

function JudgesTable({ variant }: { variant: "primary" | "secondary" }) {
  const [sort, setSort] = useState<SortDescriptor>({ column: "progress", direction: "descending" });
  const rows = useMemo(() => {
    const sorted = [...JUDGES].sort((a, b) => {
      const cmp = sort.column === "name" ? a.name.localeCompare(b.name) : a.scored - b.scored;
      return sort.direction === "descending" ? -cmp : cmp;
    });
    return sorted;
  }, [sort]);

  return (
    <Table variant={variant}>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={`Judges (${variant})`}
          className="min-w-[560px]"
          selectionMode="single"
          defaultSelectedKeys={["marcus"]}
          sortDescriptor={sort}
          onSortChange={setSort}
        >
          <Table.Header>
            <Table.Column id="name" isRowHeader allowsSorting>
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>Judge</Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column id="role">Role</Table.Column>
            <Table.Column id="progress" allowsSorting>
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>Progress</Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column id="status">Status</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((j) => (
              <Table.Row key={j.id} id={j.id}>
                <Table.Cell>{j.name}</Table.Cell>
                <Table.Cell>{j.role}</Table.Cell>
                <Table.Cell>
                  <ProgressBar
                    aria-label={`${j.name} progress`}
                    size="sm"
                    value={j.scored}
                    maxValue={j.total}
                    color={j.scored === j.total ? "success" : "accent"}
                    className="w-40"
                  >
                    <ProgressBar.Output>
                      {j.scored}/{j.total}
                    </ProgressBar.Output>
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="soft" color={STATUS_CHIP[j.status].color}>
                    {STATUS_CHIP[j.status].label}
                  </Chip>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/* TagGroup                                                            */
/* ------------------------------------------------------------------ */

const TRACKS = [
  { id: "ai", name: "Best use of AI" },
  { id: "design", name: "Best design" },
  { id: "impact", name: "Social impact" },
  { id: "hack", name: "Most technical hack" },
  { id: "first", name: "Best first-time team" },
];

function RemovableTags() {
  const [tags, setTags] = useState(TRACKS);
  return (
    <TagGroup
      aria-label="Prize tracks"
      onRemove={(keys: Set<Key>) => setTags((t) => t.filter((tag) => !keys.has(tag.id)))}
    >
      <Label>Removable</Label>
      <TagGroup.List items={tags} renderEmptyState={() => <span className="text-sm text-muted">No tracks left</span>}>
        {(tag) => (
          <Tag id={tag.id} textValue={tag.name}>
            {tag.name}
          </Tag>
        )}
      </TagGroup.List>
      <Description>Click × to remove a prize track</Description>
    </TagGroup>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export default function OverlaysSection() {
  return (
    <Section id={id} title={title}>
      {/* ---------------------------------------------------------- Modal */}
      <Demo name="Modal" hint="Backdrop › Container (size, placement, scroll) › Dialog" className="flex-col gap-5">
        <Group label="Size">
          {(["xs", "sm", "md", "lg", "cover", "full"] as const).map((s) => (
            <JudgeModal key={s} trigger={s} size={s} />
          ))}
        </Group>
        <Group label="Backdrop variant">
          {(["opaque", "blur", "transparent"] as const).map((b) => (
            <JudgeModal key={b} trigger={b} backdrop={b} />
          ))}
        </Group>
        <Group label="Placement">
          {(["auto", "center", "top", "bottom"] as const).map((p) => (
            <JudgeModal key={p} trigger={p} placement={p} />
          ))}
        </Group>
        <Group label="Scroll (long content)">
          {(["inside", "outside"] as const).map((s) => (
            <JudgeModal key={s} trigger={`scroll ${s}`} scroll={s} long />
          ))}
        </Group>
      </Demo>

      {/* ---------------------------------------------------- AlertDialog */}
      <Demo name="AlertDialog" hint="Icon status · Container size" className="flex-col gap-5">
        <Group label="Status">
          {ALERT_DIALOGS.map((d) => (
            <JudgeAlertDialog key={d.status} {...d} triggerVariant={d.status === "danger" ? "danger-soft" : "secondary"} />
          ))}
        </Group>
        <Group label="Size">
          {(["xs", "sm", "md", "lg", "cover"] as const).map((s) => (
            <JudgeAlertDialog
              key={s}
              trigger={s}
              size={s}
              status="danger"
              heading="Delete hackathon?"
              body="This permanently deletes the event, its submissions and all scores."
              confirm="Delete"
            />
          ))}
        </Group>
      </Demo>

      {/* --------------------------------------------------------- Drawer */}
      <Demo name="Drawer" hint="Content placement · Backdrop variant" className="flex-col gap-5">
        <Group label="Placement">
          {(["bottom", "top", "left", "right"] as const).map((p) => (
            <JudgeDrawer key={p} placement={p} trigger={p} />
          ))}
        </Group>
        <Group label="Backdrop variant (right)">
          {(["opaque", "blur", "transparent"] as const).map((b) => (
            <JudgeDrawer key={b} placement="right" backdrop={b} trigger={b} />
          ))}
        </Group>
      </Demo>

      {/* -------------------------------------------------------- Popover */}
      <Demo name="Popover" hint="Content placement · with / without Arrow" className="flex-col gap-5">
        <Group label="Placement (with arrow)">
          {(["top", "right", "bottom", "left"] as const).map((p) => (
            <Popover key={p}>
              <Button variant="tertiary" size="sm">
                {p}
              </Button>
              <Popover.Content placement={p}>
                <Popover.Dialog>
                  <Popover.Arrow />
                  <p className="text-sm">Rubric weight: 30%</p>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          ))}
        </Group>
        <Group label="Rich content (no arrow)">
          <Popover>
            <Button variant="secondary" size="sm">
              Scoring rubric
            </Button>
            <Popover.Content className="max-w-72">
              <Popover.Dialog>
                <Popover.Heading>Innovation</Popover.Heading>
                <p className="mt-2 text-sm text-muted">
                  How novel is the idea? Does it use AI in a way that wouldn’t be possible a year ago?
                </p>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" slot="close">
                    Got it
                  </Button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </Group>
      </Demo>

      {/* ------------------------------------------------------- Dropdown */}
      <Demo name="Dropdown" hint="Item variant · sections · shortcuts · selection · submenu">
        <Dropdown>
          <Button variant="secondary" size="sm">
            Actions
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="Submission actions">
              <Dropdown.Item id="open" textValue="Open submission">
                <Label>Open submission</Label>
              </Dropdown.Item>
              <Dropdown.Item id="reassign" textValue="Reassign judge">
                <Label>Reassign judge</Label>
              </Dropdown.Item>
              <Dropdown.Item id="disqualify" textValue="Disqualify" variant="danger">
                <Label>Disqualify team</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <Dropdown>
          <Button variant="secondary" size="sm">
            Sections + shortcuts
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="Hackathon menu" disabledKeys={["archive"]}>
              <Dropdown.Section>
                <Header>Hackathon</Header>
                <Dropdown.Item id="edit" textValue="Edit details">
                  <Label>Edit details</Label>
                  <Kbd className="ms-auto">
                    <Kbd.Abbr keyValue="command" />
                    <Kbd.Content>E</Kbd.Content>
                  </Kbd>
                </Dropdown.Item>
                <Dropdown.Item id="dup" textValue="Duplicate">
                  <Label>Duplicate</Label>
                  <Kbd className="ms-auto">
                    <Kbd.Abbr keyValue="command" />
                    <Kbd.Content>D</Kbd.Content>
                  </Kbd>
                </Dropdown.Item>
                <Dropdown.Item id="archive" textValue="Archive">
                  <Label>Archive (disabled)</Label>
                </Dropdown.Item>
              </Dropdown.Section>
              <Separator />
              <Dropdown.Section>
                <Header>Danger zone</Header>
                <Dropdown.Item id="delete" textValue="Delete hackathon" variant="danger">
                  <Label>Delete hackathon</Label>
                  <Kbd className="ms-auto">
                    <Kbd.Abbr keyValue="command" />
                    <Kbd.Abbr keyValue="delete" />
                  </Kbd>
                </Dropdown.Item>
              </Dropdown.Section>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <Dropdown>
          <Button variant="secondary" size="sm">
            Single select
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="Sort submissions" selectionMode="single" defaultSelectedKeys={["score"]}>
              {[
                ["score", "Highest score"],
                ["recent", "Most recent"],
                ["name", "Team name"],
              ].map(([k, l]) => (
                <Dropdown.Item key={k} id={k} textValue={l}>
                  <Dropdown.ItemIndicator type="dot" />
                  <Label>{l}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <Dropdown>
          <Button variant="secondary" size="sm">
            Multi select
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label="Filter tracks"
              selectionMode="multiple"
              defaultSelectedKeys={["ai", "impact"]}
            >
              {TRACKS.slice(0, 4).map((t) => (
                <Dropdown.Item key={t.id} id={t.id} textValue={t.name}>
                  <Dropdown.ItemIndicator />
                  <Label>{t.name}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <Dropdown>
          <Button variant="secondary" size="sm">
            Submenu
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="Assign">
              <Dropdown.Item id="me" textValue="Assign to me">
                <Label>Assign to me</Label>
              </Dropdown.Item>
              <Dropdown.SubmenuTrigger>
                <Dropdown.Item id="judge" textValue="Assign to judge">
                  <Label>Assign to judge</Label>
                  <Dropdown.SubmenuIndicator />
                </Dropdown.Item>
                <Dropdown.Popover>
                  <Dropdown.Menu aria-label="Judges">
                    {JUDGES.slice(0, 3).map((j) => (
                      <Dropdown.Item key={j.id} id={j.id} textValue={j.name}>
                        <Label>{j.name}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.SubmenuTrigger>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Demo>

      {/* ----------------------------------------------------------- Menu */}
      <Demo name="Menu" hint="Inline menu (no popover) · Item variant · sections · selection">
        <div className="w-60 rounded-xl border border-border p-1">
          <Menu aria-label="Judge actions">
            <Menu.Section>
              <Header>Submission</Header>
              <Menu.Item id="score" textValue="Score">
                <Label>Score submission</Label>
              </Menu.Item>
              <Menu.Item id="flag" textValue="Flag">
                <Label>Flag for review</Label>
              </Menu.Item>
              <Menu.Item id="skip" textValue="Skip" isDisabled>
                <Label>Skip (disabled)</Label>
              </Menu.Item>
            </Menu.Section>
            <Separator />
            <Menu.Section>
              <Header>Danger</Header>
              <Menu.Item id="dq" textValue="Disqualify" variant="danger">
                <Label>Disqualify team</Label>
              </Menu.Item>
            </Menu.Section>
          </Menu>
        </div>
        <div className="w-60 rounded-xl border border-border p-1">
          <Menu aria-label="Visible columns" selectionMode="multiple" defaultSelectedKeys={["name", "score"]}>
            {[
              ["name", "Team name"],
              ["score", "Score"],
              ["track", "Track"],
              ["judge", "Assigned judge"],
            ].map(([k, l]) => (
              <Menu.Item key={k} id={k} textValue={l}>
                <Menu.ItemIndicator />
                <Label>{l}</Label>
              </Menu.Item>
            ))}
          </Menu>
        </div>
      </Demo>

      {/* ------------------------------------------------------ Accordion */}
      <Demo name="Accordion" hint="variant: default | surface · hideSeparator · allowsMultipleExpanded · disabled item">
        {(
          [
            { label: "default", props: { variant: "default" as const } },
            { label: "surface", props: { variant: "surface" as const } },
            { label: "default · hideSeparator · multiple", props: { hideSeparator: true, allowsMultipleExpanded: true } },
          ] as const
        ).map(({ label, props }) => (
          <div key={label} className="flex w-80 flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
            <Accordion {...props} defaultExpandedKeys={["criteria"]}>
              {[
                ["criteria", "How are projects scored?", "Four criteria — innovation, technical depth, design, and impact — each 1–10, weighted 30/30/20/20."],
                ["conflicts", "What about conflicts of interest?", "Judges must recuse themselves from teams they mentored. Recused submissions are reassigned automatically."],
                ["ties", "How are ties broken?", "The lead judge casts the deciding vote after a short deliberation."],
              ].map(([k, q, a]) => (
                <Accordion.Item key={k} id={k}>
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      {q}
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>{a}</Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
              <Accordion.Item id="locked" isDisabled>
                <Accordion.Heading>
                  <Accordion.Trigger>
                    Final results (locked)
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body>Available after publishing.</Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </div>
        ))}
      </Demo>

      {/* ----------------------------------------------------- Disclosure */}
      <Demo name="Disclosure" hint="Standalone expandable · default trigger vs Button slot=trigger">
        <div className="w-80">
          <Disclosure defaultExpanded>
            <Disclosure.Heading>
              <Disclosure.Trigger>
                Judging guidelines
                <Disclosure.Indicator />
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body>
                <p className="text-sm text-muted">
                  Spend ~8 minutes per submission. Watch the demo video first, then skim the repo.
                </p>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </div>
        <div className="w-80">
          <Disclosure>
            <Disclosure.Heading>
              <Button slot="trigger" variant="secondary" fullWidth>
                <span className="flex-1 text-start">Show judge notes</span>
                <Disclosure.Indicator />
              </Button>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body>
                <p className="text-sm text-muted">“Great demo, but the README setup steps didn’t work on macOS.”</p>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </div>
        <div className="w-80">
          <Disclosure isDisabled>
            <Disclosure.Heading>
              <Disclosure.Trigger>
                Disabled disclosure
                <Disclosure.Indicator />
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body>Hidden</Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </div>
      </Demo>

      {/* ------------------------------------------------ DisclosureGroup */}
      <Demo name="DisclosureGroup" hint="Single-expand (default) vs allowsMultipleExpanded">
        {[
          { label: "single expand", multiple: false },
          { label: "allowsMultipleExpanded", multiple: true },
        ].map(({ label, multiple }) => (
          <div key={label} className="flex w-80 flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
            <DisclosureGroup allowsMultipleExpanded={multiple} defaultExpandedKeys={["demo"]}>
              {[
                ["demo", "Demo video", "3:42 walkthrough of the agent reviewing a real pull request."],
                ["repo", "Repository", "github.com/team-orbit/agentic-reviewer · 214 commits"],
                ["deck", "Pitch deck", "12 slides · uploaded 2h before deadline"],
              ].map(([k, h, b], i) => (
                <div key={k}>
                  {i > 0 && <Separator className="my-1" />}
                  <Disclosure id={k}>
                    <Disclosure.Heading>
                      <Disclosure.Trigger>
                        {h}
                        <Disclosure.Indicator />
                      </Disclosure.Trigger>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                      <Disclosure.Body>
                        <p className="text-sm text-muted">{b}</p>
                      </Disclosure.Body>
                    </Disclosure.Content>
                  </Disclosure>
                </div>
              ))}
            </DisclosureGroup>
          </div>
        ))}
      </Demo>

      {/* ----------------------------------------------------------- Tabs */}
      <Demo name="Tabs" hint="variant: primary | secondary · align · orientation · separators · disabled" className="flex-col gap-6">
        {(
          [
            { label: "primary", props: {} },
            { label: "secondary", props: { variant: "secondary" as const } },
            { label: "primary · align start · separators", props: { align: "start" as const }, sep: true },
            { label: "secondary · align end", props: { variant: "secondary" as const, align: "end" as const } },
          ] as const
        ).map(({ label, props, ...rest }) => (
          <Group key={label} label={label} className="w-full max-w-xl">
            <Tabs {...props} defaultSelectedKey="queue" className="w-full">
              <Tabs.ListContainer>
                <Tabs.List aria-label={`Judging tabs (${label})`}>
                  {[
                    ["queue", "My queue"],
                    ["scored", "Scored"],
                    ["flagged", "Flagged"],
                    ["archived", "Archived"],
                  ].map(([k, l], i) => (
                    <Tabs.Tab key={k} id={k} isDisabled={k === "archived"}>
                      {"sep" in rest && rest.sep && i > 0 && <Tabs.Separator />}
                      {l}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="queue" className="pt-3 text-sm text-muted">
                8 submissions waiting for your score.
              </Tabs.Panel>
              <Tabs.Panel id="scored" className="pt-3 text-sm text-muted">
                34 scored · avg 7.4
              </Tabs.Panel>
              <Tabs.Panel id="flagged" className="pt-3 text-sm text-muted">
                2 flagged for plagiarism review.
              </Tabs.Panel>
              <Tabs.Panel id="archived" className="pt-3 text-sm text-muted">
                —
              </Tabs.Panel>
            </Tabs>
          </Group>
        ))}
        <Group label="vertical (primary / secondary)" className="flex flex-wrap gap-10">
          {(["primary", "secondary"] as const).map((v) => (
            <Tabs key={v} variant={v} orientation="vertical" defaultSelectedKey="overview">
              <Tabs.ListContainer>
                <Tabs.List aria-label={`Settings (${v})`}>
                  {[
                    ["overview", "Overview"],
                    ["rubric", "Rubric"],
                    ["judges", "Judges"],
                  ].map(([k, l]) => (
                    <Tabs.Tab key={k} id={k}>
                      {l}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="overview" className="px-4 text-sm text-muted">
                Event overview
              </Tabs.Panel>
              <Tabs.Panel id="rubric" className="px-4 text-sm text-muted">
                Rubric editor
              </Tabs.Panel>
              <Tabs.Panel id="judges" className="px-4 text-sm text-muted">
                Judge roster
              </Tabs.Panel>
            </Tabs>
          ))}
        </Group>
      </Demo>

      {/* ---------------------------------------------------- Breadcrumbs */}
      <Demo name="Breadcrumbs" hint="Default separator · custom separator · disabled" className="flex-col gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="#">Hackathons</Breadcrumbs.Item>
          <Breadcrumbs.Item href="#">Nebius AI Hack 2026</Breadcrumbs.Item>
          <Breadcrumbs.Item href="#">Submissions</Breadcrumbs.Item>
          <Breadcrumbs.Item>Team Orbit</Breadcrumbs.Item>
        </Breadcrumbs>
        <Breadcrumbs separator={<span className="px-1 text-muted">/</span>}>
          <Breadcrumbs.Item href="#">Settings</Breadcrumbs.Item>
          <Breadcrumbs.Item href="#">Judging</Breadcrumbs.Item>
          <Breadcrumbs.Item>Rubric</Breadcrumbs.Item>
        </Breadcrumbs>
        <Breadcrumbs isDisabled>
          <Breadcrumbs.Item href="#">Hackathons</Breadcrumbs.Item>
          <Breadcrumbs.Item href="#">Archived</Breadcrumbs.Item>
          <Breadcrumbs.Item>Disabled trail</Breadcrumbs.Item>
        </Breadcrumbs>
      </Demo>

      {/* ----------------------------------------------------- Pagination */}
      <Demo name="Pagination" hint="size: sm | md | lg · Summary · Ellipsis" className="flex-col gap-5">
        {SIZES.map((s) => (
          <Group key={s} label={s} className="w-full max-w-2xl">
            <PaginationDemo size={s} total={s === "sm" ? 4 : 10} />
          </Group>
        ))}
      </Demo>

      {/* ---------------------------------------------------------- Table */}
      <Demo name="Table" hint="variant: primary | secondary · sortable columns · single selection" className="flex-col gap-6">
        {(["primary", "secondary"] as const).map((v) => (
          <Group key={v} label={v} className="w-full">
            <JudgesTable variant={v} />
          </Group>
        ))}
      </Demo>

      {/* ------------------------------------------------------- TagGroup */}
      <Demo name="TagGroup" hint="size · variant · selectionMode · onRemove · disabledKeys" className="flex-col gap-5">
        <div className="flex flex-wrap gap-8">
          {SIZES.map((s) => (
            <TagGroup key={s} size={s} selectionMode="single" defaultSelectedKeys={["ai"]}>
              <Label>size {s}</Label>
              <TagGroup.List>
                {TRACKS.slice(0, 3).map((t) => (
                  <Tag key={t.id} id={t.id}>
                    {t.name}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
          ))}
        </div>
        <div className="flex flex-wrap gap-8">
          {(["default", "surface"] as const).map((v) => (
            <TagGroup key={v} variant={v} selectionMode="multiple" defaultSelectedKeys={["ai", "impact"]} disabledKeys={["first"]}>
              <Label>variant {v} · multiple</Label>
              <TagGroup.List>
                {TRACKS.map((t) => (
                  <Tag key={t.id} id={t.id}>
                    {t.name}
                  </Tag>
                ))}
              </TagGroup.List>
              <Description>“Best first-time team” is disabled</Description>
            </TagGroup>
          ))}
        </div>
        <RemovableTags />
      </Demo>

      {/* ---------------------------------------------------------- Alert */}
      <Demo name="Alert" hint="status: default | accent | success | warning | danger" className="flex-col">
        <div className="grid w-full max-w-2xl gap-3">
          <Alert>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Judging opens Saturday at 9:00</Alert.Title>
              <Alert.Description>You’ll get an email when your queue is ready.</Alert.Description>
            </Alert.Content>
          </Alert>
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>8 submissions in your queue</Alert.Title>
              <Alert.Description>Average time per submission is about 8 minutes.</Alert.Description>
            </Alert.Content>
            <Button size="sm">Start judging</Button>
          </Alert>
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Winners published</Alert.Title>
            </Alert.Content>
            <CloseButton aria-label="Dismiss" />
          </Alert>
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Tom Okafor is behind schedule</Alert.Title>
              <Alert.Description>4 of 42 scored with 3 hours left. Consider reassigning.</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="secondary">
              Reassign
            </Button>
          </Alert>
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Score sync failed</Alert.Title>
              <Alert.Description>
                We couldn’t save 2 scores:
                <ul className="mt-1 list-inside list-disc text-sm">
                  <li>Team Atlas — network timeout</li>
                  <li>Team Quill — submission was withdrawn</li>
                </ul>
              </Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="danger">
              Retry
            </Button>
          </Alert>
          <Alert status="accent">
            <Alert.Indicator>
              <Spinner size="sm" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>AI pre-screening 42 submissions…</Alert.Title>
              <Alert.Description>Custom indicator (Spinner)</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      </Demo>

      {/* ---------------------------------------------------------- Toast */}
      <Demo
        name="Toast"
        hint="<Toast.Provider /> rendered locally · toast() / .success / .info / .warning / .danger / .promise"
      >
        <Toast.Provider placement="bottom end" />
        <Button size="sm" variant="secondary" onPress={() => toast("Draft saved")}>
          default
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => toast("Judge invited", { variant: "accent", description: "Lena will get an email shortly." })}
        >
          accent
        </Button>
        <Button size="sm" variant="secondary" onPress={() => toast.info("Judging opens in 10 minutes")}>
          info
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => toast.success("Winners published", { description: "42 teams notified by email." })}
        >
          success
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => toast.warning("3 submissions still unscored", { description: "Deadline is in 1 hour." })}
        >
          warning
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => toast.danger("Couldn’t delete hackathon", { description: "You need owner permissions." })}
        >
          danger
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            const tid = toast("Team Orbit disqualified", {
              description: "Their scores were removed from the leaderboard.",
              actionProps: { children: "Undo", variant: "tertiary", onPress: () => toast.close(tid) },
            });
          }}
        >
          with action
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            toast.promise(() => new Promise<number>((r) => setTimeout(() => r(42), 1500)), {
              loading: "Calculating final rankings…",
              success: (n) => `Rankings ready for ${n} teams`,
              error: "Ranking failed",
            })
          }
        >
          promise / loading
        </Button>
      </Demo>

      {/* ---------------------------------------------------- ProgressBar */}
      <Demo name="ProgressBar" hint="color × size · indeterminate">
        <Group label="color" className="flex w-64 flex-col gap-4">
          {STATUSES.map((c, i) => (
            <ProgressBar key={c} color={c} value={30 + i * 15}>
              <Label>{c}</Label>
              <ProgressBar.Output />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          ))}
        </Group>
        <Group label="size" className="flex w-64 flex-col gap-4">
          {SIZES.map((s) => (
            <ProgressBar key={s} size={s} value={34} maxValue={42}>
              <Label>Scored ({s})</Label>
              <ProgressBar.Output />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          ))}
        </Group>
        <Group label="indeterminate · no label" className="flex w-64 flex-col gap-4">
          <ProgressBar isIndeterminate aria-label="Uploading">
            <Label>Uploading demo video…</Label>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <ProgressBar aria-label="Bare progress" value={70}>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Group>
      </Demo>

      {/* ------------------------------------------------- ProgressCircle */}
      <Demo name="ProgressCircle" hint="color · size · indeterminate" className="flex-col gap-5">
        <Group label="color">
          {STATUSES.map((c) => (
            <ProgressCircle key={c} aria-label={c} color={c} value={65}>
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
          ))}
        </Group>
        <Group label="size">
          {SIZES.map((s, i) => (
            <ProgressCircle key={s} aria-label={s} size={s} value={40 + i * 20}>
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
          ))}
        </Group>
        <Group label="indeterminate">
          {SIZES.map((s) => (
            <ProgressCircle key={s} aria-label="Loading" size={s} isIndeterminate>
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
          ))}
        </Group>
      </Demo>

      {/* ---------------------------------------------------------- Meter */}
      <Demo name="Meter" hint="color × size (a static measurement, not progress)">
        <Group label="color" className="flex w-64 flex-col gap-4">
          {(
            [
              ["default", "Innovation", 6.2],
              ["accent", "Technical depth", 7.8],
              ["success", "Design", 9.1],
              ["warning", "Impact", 4.5],
              ["danger", "Completeness", 2.3],
            ] as const
          ).map(([c, l, v]) => (
            <Meter key={c} color={c} value={v} maxValue={10} formatOptions={{ maximumFractionDigits: 1 }}>
              <Label>
                {l} ({c})
              </Label>
              <Meter.Output>{v} / 10</Meter.Output>
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
          ))}
        </Group>
        <Group label="size" className="flex w-64 flex-col gap-4">
          {SIZES.map((s) => (
            <Meter key={s} size={s} value={72}>
              <Label>Storage used ({s})</Label>
              <Meter.Output />
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
          ))}
        </Group>
      </Demo>
    </Section>
  );
}
