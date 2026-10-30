import type { CSSProperties, ReactNode } from "react";
import { Column, Row, Section, Text } from "react-email";
import { demoHackathon } from "@/lib/data";
import type { FailedInboxItem } from "@/lib/failed-inbox";
import {
  Badge,
  Block,
  Divider,
  EmailShell,
  Eyebrow,
  LinkFallback,
  LipButton,
  Paragraph,
  SectionTitle,
  Tile,
  Title,
  type EmailHackathon,
} from "./_components/shell";
import { accentTokens, fonts, palette } from "./_components/theme";

// To whoever reviews agent failures (the owner by default; Setup ›
// Distribution): projects the agent failed on a must-pass check, waiting on
// their call in the agent-failed inbox (lib/failed-inbox.ts). Until someone
// decides, each failure stands.

/** A project waiting on a call, as lib/failed-inbox.ts reads it (trimmed to what the email shows). */
export type AgentInboxEmailItem = Pick<FailedInboxItem, "number" | "name" | "pitch" | "agentTotal"> & {
  gates: Pick<FailedInboxItem["gates"][number], "title" | "reason">[];
};

export type AgentInboxEmailProps = {
  hackathon: EmailHackathon;
  /** Every failure waiting on a call. */
  pending: number;
  /** The first few of them, by number; the rest are a click away. */
  items: AgentInboxEmailItem[];
  /** The phase running now, so the email can ask for calls before it closes; null when none is. */
  phaseName: string | null;
  /** Opens the inbox: /h/<slug>/judging/progress?inbox=open. */
  inboxUrl: string;
  /** 0 for the first email, then 1, 2… for reminders. */
  reminder: number;
  /**
   * The judge Setup › Distribution names to review them, if it's not the
   * owner. The email still goes to the owner: only they can decide.
   */
  reviewer?: string | null;
};

/** Projects listed in the email. */
export const MAX_ITEMS = 5;
/** The agent's reasoning, cut to a couple of lines. */
const MAX_REASON = 220;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const projectNumber = (n: number) => `#${String(n).padStart(3, "0")}`;
const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

export const agentInboxSubject = (hackathon: Pick<EmailHackathon, "name">, { pending, reminder }: Pick<AgentInboxEmailProps, "pending" | "reminder">) =>
  `${reminder ? "Reminder: " : ""}${plural(pending, "project needs", "projects need")} your call · ${hackathon.name}`;

export default function AgentInboxEmail({
  hackathon,
  pending,
  items,
  phaseName,
  inboxUrl,
  reminder,
  reviewer,
}: AgentInboxEmailProps) {
  const t = accentTokens(hackathon.color);
  const shown = items.slice(0, MAX_ITEMS);
  const more = pending - shown.length;

  return (
    <EmailShell
      hackathon={hackathon}
      preview={`The agent failed ${plural(pending, "project")} on a must-pass check. Agree or disagree in the inbox.`}
      footerNote={
        reviewer
          ? `You're getting this because agent failures for ${hackathon.name} are decided in your inbox, with ${reviewer} named to review them. Change who reviews them in Setup › Distribution.`
          : `You're getting this because you review agent failures for ${hackathon.name}. Change who does in Setup › Distribution.`
      }
    >
      <Eyebrow color={t.accent}>{hackathon.name} · Agent-failed inbox</Eyebrow>
      <Title style={{ marginTop: 12 }}>
        {reminder ? "Still waiting: " : ""}
        {plural(pending, "project needs", "projects need")} your call
      </Title>
      <Paragraph style={{ marginTop: 16 }}>
        The AI agent failed {pending === 1 ? "this project" : "these projects"} on a must-pass check. It can be wrong, so
        a person makes the final call.
        {phaseName && ` Decide before you close ${phaseName}, so the ranking is right.`}
      </Paragraph>

      {/* What each answer does, in the inbox's own words. */}
      <Row style={{ marginTop: 20 }}>
        <Choice
          tile={
            <Tile size={28} background={palette.warningSoft} color={palette.warning} fontSize={14}>
              ✕
            </Tile>
          }
          label="Agree — keep it out"
          detail="The failure stands. It ranks below every project that passed and can't win an award."
          style={{ paddingRight: 6 }}
        />
        <Choice
          tile={
            <Tile size={28} background={t.accentSoft} color={t.accentSoftForeground} fontSize={14}>
              ✓
            </Tile>
          }
          label="Disagree — back in the pool"
          detail="The failure is cleared. It ranks on its judge scores like any other project."
          style={{ paddingLeft: 6 }}
        />
      </Row>

      <Section style={{ marginTop: 28 }}>
        <LipButton href={inboxUrl} color={hackathon.color}>
          Open the inbox&nbsp;&nbsp;→
        </LipButton>
        <Text style={{ margin: "12px 0 0", fontSize: 14, lineHeight: "21px", color: palette.muted }}>
          Each call takes about a minute, with the agent&apos;s full reasoning beside it. Until you decide, the failure
          stands.
        </Text>
      </Section>

      <Divider />
      <SectionTitle hint={more > 0 ? `${shown.length} of ${pending}` : undefined}>Waiting on you</SectionTitle>
      {shown.map((item, i) => (
        <Block key={item.number} style={{ marginTop: i === 0 ? 0 : 12 }}>
          <Section style={{ padding: "14px 18px 4px" }}>
            <Row>
              <Column style={{ verticalAlign: "top" }}>
                <Text style={{ margin: 0, fontFamily: fonts.pixel, fontSize: 17, lineHeight: "22px", fontWeight: 600 }}>
                  {item.name}
                  <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 400, color: palette.muted }}>
                    &nbsp;&nbsp;{projectNumber(item.number)}
                  </span>
                </Text>
                {item.pitch && (
                  <Text style={{ margin: "2px 0 0", fontSize: 14, lineHeight: "20px", color: palette.muted }}>{item.pitch}</Text>
                )}
              </Column>
              {item.agentTotal !== null && (
                <Column align="right" style={{ width: 72, verticalAlign: "top" }}>
                  <Text style={{ margin: 0, fontFamily: fonts.pixel, fontSize: 18, lineHeight: "22px", fontWeight: 600 }}>
                    {item.agentTotal.toFixed(1)}
                  </Text>
                  <Text style={{ margin: 0, fontSize: 11, lineHeight: "16px", color: palette.muted }}>agent score</Text>
                </Column>
              )}
            </Row>
          </Section>
          {item.gates.map((g) => (
            <Section key={g.title} style={{ padding: "10px 18px 14px" }}>
              <Text style={{ margin: 0, fontSize: 14, lineHeight: "20px" }}>
                <Badge tone="warning">Failed</Badge>&nbsp;&nbsp;<b style={{ fontWeight: 600 }}>{g.title}</b>
              </Text>
              {g.reason && (
                <Text
                  style={{
                    margin: "8px 0 0",
                    padding: "2px 0 2px 12px",
                    borderLeft: `3px solid ${palette.warningSoft}`,
                    fontSize: 14,
                    lineHeight: "21px",
                    color: palette.muted,
                  }}
                >
                  {clip(g.reason, MAX_REASON)}
                </Text>
              )}
            </Section>
          ))}
        </Block>
      ))}
      {more > 0 && (
        <Text style={{ margin: "14px 0 0", fontSize: 14, lineHeight: "21px", color: palette.muted }}>
          …and {plural(more, "more project", "more projects")} in the inbox.
        </Text>
      )}

      <Divider />
      <LinkFallback href={inboxUrl} />
    </EmailShell>
  );
}

/** One answer and what it does to the project. */
function Choice({
  tile,
  label,
  detail,
  style,
}: {
  tile: ReactNode;
  label: string;
  detail: string;
  style: CSSProperties;
}) {
  return (
    <Column style={{ width: "50%", verticalAlign: "top", ...style }}>
      <Section style={{ padding: "12px 14px", backgroundColor: palette.surfaceSecondary, borderRadius: 12 }}>
        {tile}
        <Text style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px", fontWeight: 600 }}>{label}</Text>
        <Text style={{ margin: "2px 0 0", fontSize: 13, lineHeight: "19px", color: palette.muted }}>{detail}</Text>
      </Section>
    </Column>
  );
}

AgentInboxEmail.PreviewProps = {
  hackathon: demoHackathon,
  pending: 7,
  items: [
    {
      number: 71,
      name: "Grant Scout",
      pitch: "Finds and drafts research grant applications",
      agentTotal: 3.2,
      gates: [
        {
          title: "Uses Acme SDK",
          reason:
            "The repo lists @acme/sdk in package.json, but no file imports it and there are no calls to acme.generate(). The generation path uses a different provider directly, so the SDK looks installed rather than used.",
        },
      ],
    },
    {
      number: 104,
      name: "Menu Mind",
      pitch: "Voice ordering agent for small restaurants",
      agentTotal: 7.1,
      gates: [
        {
          title: "Uses Acme SDK",
          reason: "Couldn't clone the repository: it returned 404. It may be private, so the SDK check couldn't run.",
        },
      ],
    },
    {
      number: 33,
      name: "Changelog Crow",
      pitch: "Turns merged PRs into release notes",
      agentTotal: 6.4,
      gates: [{ title: "Uses Acme SDK", reason: "Only the README mentions Acme; the code calls a local model instead." }],
    },
  ],
  phaseName: "Group review",
  inboxUrl: "https://roundzero.dev/h/ai-agents-2026/judging/progress?inbox=open",
  reminder: 0,
} satisfies AgentInboxEmailProps;
