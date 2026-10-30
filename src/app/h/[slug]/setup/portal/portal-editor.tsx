"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Tabs } from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FieldLabel, Segmented, TextArea, TextInput } from "@/components/controls";
import { JudgeLinkButtons, judgeLinkPath, useCopy } from "@/components/judge-link";
import { DoneScreen, StartScreen, type ScreenCriterion } from "@/components/judge-screens";
import { SaveError, UpdateButton } from "@/components/list-editor";
import { PixelIcon } from "@/components/pixel-icon";
import { AddTile, Eyebrow, ExplainerItem, PageHeader, Panel, SectionTitle } from "@/components/ui";
import type { JudgePortalSettings } from "@/lib/data";
import { regenerateJudgeLink, savePortalSettings } from "@/lib/judge-actions";
import { JudgePhoto } from "../judges/judge-photo";

type LinkJudge = {
  id: string;
  name: string;
  title: string;
  email: string;
  imagePath: string | null;
  /** Null until *_judge_links.sql is applied. */
  accessToken: string | null;
};

type Preview = {
  criteria: ScreenCriterion[];
  projects: { id: string; name: string }[];
  daily: boolean;
  phaseLabel: string;
  phaseName: string;
};

const MAX_GOALS = 8;

/** What's saved: trimmed text and no blank goals. */
const tidy = (s: JudgePortalSettings) => ({
  welcomeTitle: s.welcomeTitle.trim(),
  welcomeMessage: s.welcomeMessage.trim(),
  goals: s.goals.map((g) => g.trim()).filter(Boolean),
  doneMessage: s.doneMessage.trim(),
});
const snapshot = (s: JudgePortalSettings) => JSON.stringify(tidy(s));

/** Setup › Judge portal: the copy on judges' start and finish screens, and (in its own tab) every judge's private link. */
export type PortalTab = "settings" | "links";

export function PortalEditor({
  initial,
  slug,
  judges: initialJudges,
  preview,
  initialTab = "settings",
}: {
  initial: JudgePortalSettings;
  slug: string;
  judges: LinkJudge[];
  preview: Preview;
  /** ?tab=links opens straight on the links. */
  initialTab?: PortalTab;
}) {
  const [tab, setTab] = useState<PortalTab>(initialTab);
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startSave] = useTransition();
  const [screen, setScreen] = useState<"start" | "done">("start");
  const [judges, setJudges] = useState(initialJudges);

  const set = (patch: Partial<JudgePortalSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setJustSaved(false);
  };
  const setGoal = (i: number, value: string) => set({ goals: settings.goals.map((g, j) => (j === i ? value : g)) });
  const removeGoal = (i: number) => set({ goals: settings.goals.filter((_, j) => j !== i) });

  const dirty = snapshot(settings) !== snapshot(saved);
  const submit = () =>
    startSave(async () => {
      setError(undefined);
      const result = await savePortalSettings(slug, settings);
      if ("error" in result) return setError(result.error);
      setSettings(result.settings);
      setSaved(result.settings);
      setJustSaved(true);
    });

  const sampleJudge = judges[0]?.name.split(/\s+/)[0] || "Alex";
  const sampleProjects = (preview.projects.length ? preview.projects : [1, 2, 3].map((n) => ({ id: `${n}`, name: `Project ${n}` }))).map(
    (p, i) => ({ ...p, done: screen === "done" || i === 0, score: screen === "done" || i === 0 ? 7.5 : null, href: null }),
  );
  const shown = tidy(settings);

  const linkCount = judges.filter((j) => j.accessToken).length;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Judge portal"
        hint="What judges see when they open their private link, and the links themselves."
        actions={tab === "settings" && <UpdateButton dirty={dirty} pending={pending} justSaved={justSaved} onPress={submit} />}
      />
      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as PortalTab)} className="w-full">
        <Tabs.ListContainer className="self-start">
          <Tabs.List aria-label="Judge portal">
            <Tabs.Tab id="settings" className="gap-1.5">
              <PixelIcon name="gear" size={12} />
              Portal settings
              {dirty && <span className="size-1.5 rounded-full bg-accent" aria-label="Unsaved changes" />}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="links" className="gap-1.5">
              <PixelIcon name="link" size={12} />
              Judge links
              <span className="font-pixel text-xs opacity-70">{linkCount}</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="settings" className="px-0 pt-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <SaveError error={error} />

              <Panel className="flex flex-col gap-6 p-6">
                <Field label="Headline" hint={<span className="font-mono text-xs">{"{name}"} = first name</span>}>
                  <TextInput
                    value={settings.welcomeTitle}
                    maxLength={120}
                    placeholder="Welcome, {name}"
                    onChange={(e) => set({ welcomeTitle: e.target.value })}
                  />
                </Field>
                <Field label="Welcome message" hint="optional">
                  <TextArea
                    rows={4}
                    maxLength={2000}
                    value={settings.welcomeMessage}
                    placeholder="Thanks for judging! We're looking for agents that do real work, not demos that only look good."
                    onChange={(e) => set({ welcomeMessage: e.target.value })}
                  />
                </Field>

                <div className="flex flex-col gap-2">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <FieldLabel>Remember the goal</FieldLabel>
                    <span className="text-muted">
                      {settings.goals.length}/{MAX_GOALS}
                    </span>
                  </span>
                  {settings.goals.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-foreground">
                        <PixelIcon name="flag" size={12} />
                      </span>
                      <TextInput
                        value={g}
                        maxLength={200}
                        aria-label={`Goal ${i + 1}`}
                        placeholder="e.g. Reward working demos over polished slides"
                        onChange={(e) => setGoal(i, e.target.value)}
                      />
                      {g.trim() ? (
                        <ConfirmButton
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label={`Remove goal ${i + 1}`}
                          className="shrink-0 text-muted hover:bg-danger-soft hover:text-danger"
                          title="Remove this goal?"
                          description={`"${g.trim()}" comes off the start screen when you update.`}
                          confirmLabel="Remove goal"
                          onConfirm={() => removeGoal(i)}
                        >
                          <PixelIcon name="trash" size={12} />
                        </ConfirmButton>
                      ) : (
                        // Nothing typed yet, so there's nothing to lose.
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label={`Remove goal ${i + 1}`}
                          className="shrink-0 text-muted"
                          onPress={() => removeGoal(i)}
                        >
                          <PixelIcon name="x" size={12} />
                        </Button>
                      )}
                    </div>
                  ))}
                  {settings.goals.length < MAX_GOALS && (
                    <AddTile onClick={() => set({ goals: [...settings.goals, ""] })}>Add a goal</AddTile>
                  )}
                  <span className="text-xs text-muted">
                    Short points judges read before they start. The criteria are listed for them anyway.
                  </span>
                </div>

                <Field label="When they finish" hint="optional">
                  <TextArea
                    rows={3}
                    maxLength={1000}
                    value={settings.doneMessage}
                    placeholder="Thanks for your time! Winners are announced on Friday at the closing ceremony."
                    onChange={(e) => set({ doneMessage: e.target.value })}
                  />
                </Field>
              </Panel>
            </div>

            <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-36 lg:self-start">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Preview</Eyebrow>
                <Segmented
                  size="sm"
                  value={screen}
                  onChange={setScreen}
                  options={[
                    { value: "start", label: "Start" },
                    { value: "done", label: "Finish" },
                  ]}
                />
              </div>
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto rounded-xl border-2 border-border bg-background shadow-block">
                {/* A judge's page at a smaller scale, so it fits beside the form. */}
                <div className="px-8 py-10" style={{ zoom: 0.72 }}>
                  {screen === "start" ? (
                    <StartScreen
                      firstName={sampleJudge}
                      settings={shown}
                      phaseLabel={preview.phaseLabel}
                      daily={preview.daily}
                      projects={sampleProjects}
                      later={preview.daily ? 6 : 0}
                      criteria={preview.criteria}
                      cta={
                        <span className="lip inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 font-semibold text-accent-foreground">
                          Keep going <PixelIcon name="arrow-right" size={12} />
                        </span>
                      }
                    />
                  ) : (
                    <DoneScreen
                      firstName={sampleJudge}
                      message={shown.doneMessage}
                      phaseName={preview.phaseName}
                      projects={sampleProjects}
                      later={preview.daily ? 6 : 0}
                      more={
                        <Panel className="px-6 py-7 text-center text-sm text-muted">
                          With daily batches, judges can start their next batch early from here.
                        </Panel>
                      }
                    />
                  )}
                </div>
              </div>
            </aside>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="links" className="px-0 pt-8">
          <JudgeLinks judges={judges} slug={slug} onChange={setJudges} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function JudgeLinks({
  judges,
  slug,
  onChange,
}: {
  judges: LinkJudge[];
  slug: string;
  onChange: (judges: LinkJudge[]) => void;
}) {
  const { copied, copy } = useCopy();
  const withLinks = judges.filter((j) => j.accessToken);
  const copyAll = () =>
    copy(
      withLinks
        .map((j) => `${j.name}${j.email ? ` <${j.email}>` : ""}\t${new URL(judgeLinkPath(j.accessToken!), window.location.origin).href}`)
        .join("\n"),
    );

  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <SectionTitle
          hint="one private link each"
          action={
            withLinks.length > 1 && (
              <Button size="sm" variant="secondary" onPress={copyAll}>
                <PixelIcon name={copied ? "check" : "copy"} size={12} />
                {copied ? "Copied" : "Copy all links"}
              </Button>
            )
          }
        >
          {judges.length} {judges.length === 1 ? "judge" : "judges"}
        </SectionTitle>
        {judges.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border px-6 py-10 text-center text-muted">
            No judges yet.{" "}
            <Link href={`/h/${slug}/setup/judges`} className="underline underline-offset-4">
              Add judges
            </Link>{" "}
            and each one gets a link.
          </p>
        ) : (
          <Panel className="divide-y divide-border">
            {judges.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <JudgePhoto name={j.name} imagePath={j.imagePath} size={32} />
                <div className="flex min-w-40 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{j.name}</span>
                  <span className="truncate text-xs text-muted">{j.email || j.title || "No email yet"}</span>
                </div>
                {j.accessToken ? (
                  <>
                    <code className="hidden max-w-56 truncate font-mono text-xs text-muted md:block">
                      {judgeLinkPath(j.accessToken)}
                    </code>
                    <JudgeLinkButtons token={j.accessToken} name={j.name} />
                    <NewLinkButton judge={j} slug={slug} onDone={onChange} />
                  </>
                ) : (
                  <span className="text-xs text-muted">Link appears once the database update is applied</span>
                )}
              </div>
            ))}
          </Panel>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3 text-sm">
          <ExplainerItem icon="lock" title="Private">
            A link opens only that judge&apos;s queue, and anyone who has it can score as them. Send each one directly.
          </ExplainerItem>
          <ExplainerItem icon="refresh" title="Leaked?">
            Make a new link. The old one stops working straight away.
          </ExplainerItem>
          <ExplainerItem icon="calendar" title="Every round">
            The same link works in each phase and shows whatever that judge has in the running one.
          </ExplainerItem>
        </ul>
      </aside>
    </section>
  );
}

function NewLinkButton({
  judge,
  slug,
  onDone,
}: {
  judge: LinkJudge;
  slug: string;
  onDone: (judges: LinkJudge[]) => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <ConfirmButton
      variant="ghost"
      size="sm"
      className="text-muted hover:bg-danger-soft hover:text-danger"
      title={`Make a new link for ${judge.name}?`}
      description="Their current link stops working straight away. Send them the new one."
      confirmLabel="Make new link"
      pendingLabel="Making…"
      onConfirm={async () => {
        const result = await regenerateJudgeLink(slug, judge.id);
        if ("error" in result) return result.error;
        startTransition(() =>
          onDone(
            result.directory.judges.map((j) => ({
              id: j.id,
              name: j.name,
              title: j.title,
              email: j.email,
              imagePath: j.imagePath,
              accessToken: j.accessToken ?? null,
            })),
          ),
        );
      }}
    >
      New link
    </ConfirmButton>
  );
}
