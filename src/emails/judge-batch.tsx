import { Row, Section } from "react-email";
import { demoHackathon } from "@/lib/data";
import {
  Divider,
  EmailShell,
  Eyebrow,
  LinkFallback,
  LipButton,
  Paragraph,
  Stat,
  Title,
  type EmailHackathon,
} from "./_components/shell";
import { accentTokens } from "./_components/theme";

// Follow-ups to a judge during a phase (src/workflows/judging-phase.ts):
//   • "batch": the next day's projects just opened on their link.
//   • "last call": the phase's time is up and they still have projects left.
// The first email of a phase is judge-invite.tsx.

export type JudgeBatchEmailProps = {
  hackathon: EmailHackathon;
  variant: "batch" | "last call";
  firstName: string;
  /** Full URL of the judge's private page. */
  judgeUrl: string;
  /** e.g. "Group review · round 1 of 2". */
  phaseLabel: string;
  /** 1-based day of the batch that just opened; ignored for "last call". */
  day: number;
  /** Projects that just opened ("batch"), or everything left ("last call"). */
  fresh: number;
  /** Earlier projects still waiting for a score ("batch" only). */
  leftover: number;
  /** Scored so far, of `total` in their queue for this phase. */
  done: number;
  total: number;
  /** Rough minutes for what's waiting. */
  minutes: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const judgeBatchSubject = (
  hackathon: Pick<EmailHackathon, "name">,
  { variant, fresh, day }: Pick<JudgeBatchEmailProps, "variant" | "fresh" | "day">,
) =>
  variant === "last call"
    ? `${plural(fresh, "project")} left to judge for ${hackathon.name}`
    : `Day ${day}: ${plural(fresh, "new project")} to judge for ${hackathon.name}`;

export default function JudgeBatchEmail({
  hackathon,
  variant,
  firstName,
  judgeUrl,
  phaseLabel,
  day,
  fresh,
  leftover,
  done,
  total,
  minutes,
}: JudgeBatchEmailProps) {
  const t = accentTokens(hackathon.color);
  const lastCall = variant === "last call";
  const waiting = lastCall ? fresh : fresh + leftover;
  const intro = lastCall
    ? `judging time for this round is up, and ${plural(fresh, "project is", "projects are")} still waiting for your score. The organizers are about to pick who goes through, so anything you can get to now counts.`
    : `today's batch is open: ${plural(fresh, "new project")}${
        leftover ? `, plus ${leftover} from earlier still waiting for a score` : ""
      }.`;

  return (
    <EmailShell
      hackathon={hackathon}
      preview={lastCall ? `${plural(fresh, "project")} left to score before the round closes.` : `Day ${day}: ${plural(fresh, "new project")} to judge.`}
      footerNote={`You're getting this because you're judging ${hackathon.name}.`}
    >
      <Eyebrow color={t.accent}>
        {hackathon.name} · {phaseLabel}
      </Eyebrow>
      <Title style={{ marginTop: 12 }}>{lastCall ? "Last call for scores" : `Day ${day} is open`}</Title>
      <Paragraph style={{ marginTop: 16 }}>
        Hi {firstName}, {intro}
      </Paragraph>

      <Row style={{ marginTop: 24 }}>
        <Stat value={waiting} label={waiting === 1 ? "project waiting" : "projects waiting"} style={{ paddingRight: 8 }} />
        <Stat value={minutes} label="minutes" style={{ padding: "0 4px" }} />
        <Stat value={done} unit={`/${total}`} label="scored so far" style={{ paddingLeft: 8 }} />
      </Row>

      <Section style={{ marginTop: 32 }}>
        <LipButton href={judgeUrl} color={hackathon.color}>
          {lastCall ? "Finish judging" : "Open today's batch"}&nbsp;&nbsp;→
        </LipButton>
      </Section>

      <Divider />
      <LinkFallback href={judgeUrl} />
    </EmailShell>
  );
}

JudgeBatchEmail.PreviewProps = {
  hackathon: demoHackathon,
  variant: "batch",
  firstName: "Marcus",
  judgeUrl: "https://roundzero.dev/j/q7Vd2kLxP9mT4wZr8sYbN3cH",
  phaseLabel: "Group review · round 1 of 2",
  day: 2,
  fresh: 5,
  leftover: 1,
  done: 4,
  total: 22,
  minutes: 24,
} satisfies JudgeBatchEmailProps;
