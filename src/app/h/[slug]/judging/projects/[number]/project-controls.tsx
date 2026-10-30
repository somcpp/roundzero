"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, Header, Label, Separator, type Key } from "@heroui/react";
import { ConfirmDialog } from "@/components/confirm-button";
import { TextArea } from "@/components/controls";
import { SaveError } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { Spinner } from "@/components/shadcn/spinner";
import { Eyebrow } from "@/components/ui";
import type { JudgingPhase, ProjectRecord, ProjectStatus, SchemaBlock } from "@/lib/data";
import {
  type ProjectActionResult,
  addProjectNote,
  deleteProject,
  moveProjects,
  setProjectStatus,
} from "@/lib/judging-actions";
import { ProjectDrawer, type ProjectDraft } from "../project-drawer";

const NONE = "__none__";

export function EditProjectButton({
  project,
  name,
  blocks,
  slug,
}: {
  project: ProjectRecord;
  name: string;
  blocks: SchemaBlock[];
  slug: string;
}) {
  const [target, setTarget] = useState<ProjectDraft | null>(null);
  return (
    <>
      <Button variant="secondary" onPress={() => setTarget({ id: project.id, values: project.values, contactEmail: project.contactEmail })}>
        <PixelIcon name="paint-brush" size={12} />
        Edit
      </Button>
      <ProjectDrawer
        target={target}
        isNew={false}
        title={name}
        blocks={blocks}
        slug={slug}
        onClose={() => setTarget(null)}
      />
    </>
  );
}

type StatusChange = Exclude<ProjectStatus, "active">;

const STATUS_COPY: Record<StatusChange, { verb: string; pending: string; description: string }> = {
  eliminated: {
    verb: "Eliminate",
    pending: "Eliminating…",
    description: "It stays in its phase but drops out of the running. You can reinstate it later.",
  },
  disqualified: {
    verb: "Disqualify",
    pending: "Disqualifying…",
    description: "It's ruled out of judging and every judge's queue. You can reinstate it later.",
  },
};

/**
 * The gear menu beside Edit: the project's phase, taking it out of the running
 * (with a reason for the audit trail) or bringing it back, and deleting it.
 */
export function ProjectSettings({
  project,
  phases,
  name,
  slug,
}: {
  project: ProjectRecord;
  phases: JudgingPhase[];
  name: string;
  slug: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  // The status dialog keeps its wording while it animates closed.
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; status: StatusChange }>({
    open: false,
    status: "eliminated",
  });
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const active = project.status === "active";
  const copy = STATUS_COPY[statusDialog.status];

  const run = (fn: () => Promise<ProjectActionResult>) =>
    start(async () => {
      setError(undefined);
      const result = await fn();
      if ("error" in result) setError(result.error);
    });

  const onAction = (key: Key) => {
    const k = String(key);
    if (k.startsWith("phase:")) {
      const id = k.slice("phase:".length);
      const phaseId = id === NONE ? null : id;
      if (phaseId !== project.phaseId) run(() => moveProjects(slug, [project.id], phaseId));
    } else if (k === "reinstate") {
      run(() => setProjectStatus(slug, [project.id], "active"));
    } else if (k === "eliminated" || k === "disqualified") {
      setStatusDialog({ open: true, status: k });
    } else if (k === "delete") {
      setDeleting(true);
    }
  };

  const closeStatus = () => {
    setStatusDialog((d) => ({ ...d, open: false }));
    setReason("");
  };

  return (
    <div className="relative">
      <Dropdown>
        <Button variant="secondary" isIconOnly aria-label="Project settings" isDisabled={readOnly || pending}>
          {pending ? <Spinner className="size-4" /> : <PixelIcon name="gear" size={14} />}
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-60">
          <Dropdown.Menu aria-label={`Settings for ${name}`} onAction={onAction}>
            <Dropdown.Section>
              <Header>Phase</Header>
              {phases.map((p, i) => (
                <Dropdown.Item key={p.id} id={`phase:${p.id}`} textValue={p.name}>
                  <Current on={p.id === project.phaseId} />
                  <Label>
                    {i + 1}. {p.name}
                  </Label>
                </Dropdown.Item>
              ))}
              <Dropdown.Item id={`phase:${NONE}`} textValue="Not in a phase">
                <Current on={project.phaseId === null} />
                <Label>Not in a phase</Label>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator />
            <Dropdown.Section>
              <Header>Status</Header>
              {active ? (
                <>
                  <Dropdown.Item id="eliminated" textValue="Eliminate">
                    <PixelIcon name="x-circle" size={12} />
                    <Label>Eliminate…</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="disqualified" textValue="Disqualify" variant="danger">
                    <PixelIcon name="ban" size={12} />
                    <Label>Disqualify…</Label>
                  </Dropdown.Item>
                </>
              ) : (
                <Dropdown.Item id="reinstate" textValue="Reinstate">
                  <PixelIcon name="refresh" size={12} />
                  <Label>Reinstate</Label>
                </Dropdown.Item>
              )}
            </Dropdown.Section>
            <Separator />
            <Dropdown.Section>
              <Dropdown.Item id="delete" textValue="Delete project" variant="danger">
                <PixelIcon name="trash" size={12} />
                <Label>Delete project…</Label>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {error && (
        <p
          role="alert"
          className="absolute top-full right-0 z-20 mt-2 flex w-72 items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setError(undefined)}
            className="mt-1 shrink-0 opacity-70 hover:opacity-100"
          >
            <PixelIcon name="x" size={10} />
          </button>
        </p>
      )}

      <ConfirmDialog
        isOpen={statusDialog.open}
        onCancel={closeStatus}
        title={`${copy.verb} ${name}?`}
        description={copy.description}
        confirmLabel={copy.verb}
        pendingLabel={copy.pending}
        onConfirm={async () => {
          const result = await setProjectStatus(slug, [project.id], statusDialog.status, reason);
          if ("error" in result) return result.error;
          closeStatus();
        }}
      >
        <label className="mt-4 flex flex-col gap-2">
          <Eyebrow>Reason</Eyebrow>
          <TextArea
            rows={3}
            value={reason}
            maxLength={2000}
            placeholder="Optional. It goes in the audit trail."
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={deleting}
        onCancel={() => setDeleting(false)}
        title={`Delete ${name}?`}
        description="The project, its answers and its whole audit trail are deleted. This can't be undone."
        confirmLabel="Delete project"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          const result = await deleteProject(slug, project.id);
          if ("error" in result) return result.error;
          setDeleting(false);
          router.push(`/h/${slug}/judging/projects`);
        }}
      />
    </div>
  );
}

/** A check beside the phase the project is in, and a same-width gap beside the rest. */
function Current({ on }: { on: boolean }) {
  return <PixelIcon name="check" size={12} className={on ? "text-accent" : "invisible"} />;
}

export function NoteComposer({ projectId, slug }: { projectId: string; slug: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const readOnly = useReadOnly();
  const submit = () =>
    start(async () => {
      setError(undefined);
      const result = await addProjectNote(slug, projectId, note);
      if ("error" in result) return setError(result.error);
      setNote("");
    });

  // Notes go on the audit trail, so a read-only view has nothing to add.
  if (readOnly) return null;
  return (
    <div className="flex flex-col gap-2">
      <SaveError error={error} />
      <TextArea
        rows={2}
        value={note}
        maxLength={2000}
        placeholder="Add a note to the trail…"
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && note.trim()) submit();
        }}
      />
      {note.trim() && (
        <div className="flex justify-end">
          <Button size="sm" onPress={submit} isDisabled={pending}>
            {pending ? "Adding…" : "Add note"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A timestamp in the viewer's timezone. */
export function LocalTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <time dateTime={iso} title={d.toLocaleString()} suppressHydrationWarning>
      {d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
    </time>
  );
}
