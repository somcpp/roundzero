import { Column, Row, Section, Text } from "react-email";
import { criteria as demoCriteria, demoHackathon, type JudgePortalSettings } from "@/lib/data";
import type { PortalCriterion } from "@/lib/judge-portal";
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
  Stat,
  Tile,
  Title,
  type EmailHackathon,
} from "./_components/shell";
import { accentTokens, fonts, palette } from "./_components/theme";

// Sent to each judge with their private link (/j/<token>). Mirrors the start
// screen on that link: what's waiting, the organizers' note and goals, and
// the criteria they'll score.

export type JudgeInviteEmailProps = {
  hackathon: EmailHackathon;
  /** The judge's first name, for the greeting. */
  firstName: string;
  /** Full URL of the judge's private page. */
  judgeUrl: string;
  /** e.g. "Group review · round 1 of 2"; null before judging starts. */
  phaseLabel: string | null;
  /** Projects in the judge's queue; 0 when it hasn't been filled yet. */
  projects: number;
  /** Projects that open each day when work goes out in daily batches; null when it all opens at once. */
  perDay: number | null;
  /** Rough minutes of work, for all of it or for a day's batch. */
  minutes: number;
  settings: Pick<JudgePortalSettings, "welcomeMessage" | "goals">;
  /** Who signs the organizers' note, e.g. the winner email's sender name. */
  fromName: string;
  criteria: Pick<PortalCriterion, "id" | "title" | "description" | "scale" | "weight" | "gate">[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const judgeInviteSubject = (hackathon: Pick<EmailHackathon, "name">) => `You're judging ${hackathon.name}`;

export default function JudgeInviteEmail({
  hackathon,
  firstName,
  judgeUrl,
  phaseLabel,
  projects,
  perDay,
  minutes,
  settings,
  fromName,
  criteria,
}: JudgeInviteEmailProps) {
  const t = accentTokens(hackathon.color);
  const daily = perDay !== null && perDay < projects;
  const intro =
    projects === 0
      ? "Your queue opens when judging starts. Keep this email: the button below is how you get in."
      : daily
        ? `${plural(projects, "project is", "projects are")} lined up for you, about ${perDay} a day. Today's batch is open now.`
        : `${plural(projects, "project is", "projects are")} ready for you to score.`;

  return (
    <EmailShell
      hackathon={hackathon}
      preview={projects === 0 ? `Your judging link for ${hackathon.name} is inside.` : intro}
      footerNote={`You're getting this because ${hackathon.name} added you as a judge.`}
    >
      <Eyebrow color={t.accent}>{phaseLabel ? `${hackathon.name} · ${phaseLabel}` : `${hackathon.name} · Judging`}</Eyebrow>
      <Title style={{ marginTop: 12 }}>You&apos;re judging {hackathon.name}</Title>
      <Paragraph style={{ marginTop: 16 }}>
        Hi {firstName}, {intro.charAt(0).toLowerCase() + intro.slice(1)}
      </Paragraph>

      {projects > 0 && (
        <Row style={{ marginTop: 24 }}>
          <Stat
            value={daily ? perDay! : projects}
            unit={daily ? "/day" : undefined}
            label={projects === 1 ? "project" : "projects"}
            style={{ paddingRight: 8 }}
          />
          <Stat value={minutes} unit={daily ? "/day" : undefined} label="minutes" style={{ padding: "0 4px" }} />
          <Stat value={criteria.length} label={criteria.length === 1 ? "criterion" : "criteria"} style={{ paddingLeft: 8 }} />
        </Row>
      )}

      {settings.welcomeMessage.trim() && (
        <Section
          style={{
            marginTop: 28,
            padding: "16px 20px",
            backgroundColor: t.accentSoft,
            borderLeft: `4px solid ${t.accent}`,
            borderRadius: 8,
          }}
        >
          <Eyebrow color={t.accentSoftForeground}>A note from the organizers</Eyebrow>
          <Paragraph style={{ marginTop: 8, fontSize: 15, lineHeight: "24px" }}>{settings.welcomeMessage.trim()}</Paragraph>
          <Text style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px", color: t.accentSoftForeground }}>
            — {fromName}
          </Text>
        </Section>
      )}

      <Section style={{ marginTop: 32 }}>
        <LipButton href={judgeUrl} color={hackathon.color}>
          {projects === 0 ? "Open my judge page" : "Start judging"}&nbsp;&nbsp;→
        </LipButton>
        <Text style={{ margin: "14px 0 0", fontSize: 14, lineHeight: "21px", color: palette.muted }}>
          This link is yours alone. It opens your queue without a password, so please don&apos;t forward it. Each score
          saves when you submit it, so you can stop and come back any time.
        </Text>
      </Section>

      {settings.goals.length > 0 && (
        <>
          <Divider />
          <SectionTitle>Remember the goal</SectionTitle>
          {settings.goals.map((goal, i) => (
            <Row key={`${i}-${goal}`} style={{ marginTop: i === 0 ? 0 : 10 }}>
              <Column style={{ width: 40, verticalAlign: "top" }}>
                <Tile size={28} background={t.accentSoft} color={t.accentSoftForeground} fontSize={13}>
                  {i + 1}
                </Tile>
              </Column>
              <Column style={{ verticalAlign: "top", paddingTop: 3, fontSize: 15, lineHeight: "22px" }}>{goal}</Column>
            </Row>
          ))}
        </>
      )}

      {criteria.length > 0 && (
        <>
          <Divider />
          <SectionTitle hint="on every project">What you&apos;ll score</SectionTitle>
          <Block>
            {criteria.map((c, i) => (
              <Section
                key={c.id}
                style={{ padding: "14px 18px", borderTop: i === 0 ? undefined : `1px solid ${palette.border}` }}
              >
                <Text style={{ margin: 0, fontSize: 15, lineHeight: "22px" }}>
                  <span style={{ fontWeight: 500 }}>{c.title}</span>
                  &nbsp;&nbsp;
                  <span style={{ fontFamily: fonts.pixel, fontSize: 12, color: palette.muted }}>{c.weight}%</span>
                  {c.scale === "pass_fail" && (
                    <>
                      &nbsp;&nbsp;<Badge>pass / fail</Badge>
                    </>
                  )}
                  {c.gate && (
                    <>
                      &nbsp;&nbsp;<Badge tone="warning">must pass</Badge>
                    </>
                  )}
                </Text>
                {c.description && (
                  <Text style={{ margin: "4px 0 0", fontSize: 14, lineHeight: "20px", color: palette.muted }}>
                    {c.description}
                  </Text>
                )}
              </Section>
            ))}
          </Block>
        </>
      )}

      <Divider />
      <LinkFallback href={judgeUrl} />
    </EmailShell>
  );
}

JudgeInviteEmail.PreviewProps = {
  hackathon: demoHackathon,
  firstName: "Marcus",
  judgeUrl: "https://roundzero.dev/j/q7Vd2kLxP9mT4wZr8sYbN3cH",
  phaseLabel: "Group review · round 1 of 2",
  projects: 22,
  perDay: null,
  minutes: 22 * 4,
  settings: {
    welcomeMessage:
      "Thanks for giving your weekend to this. 112 teams shipped agents in 48 hours, and your scores decide who goes through to the final panel. Trust your gut, and leave a line of notes when a score surprises you.",
    goals: [
      "Reward agents that finish real work, not impressive demos of half a task.",
      "A rough UI is fine. Judge what the agent does.",
      "If you know a team, skip the project and we'll reassign it.",
    ],
  },
  fromName: "The AI Agents Hack team",
  criteria: demoCriteria,
} satisfies JudgeInviteEmailProps;
