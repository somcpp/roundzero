import type { ReactNode } from "react";
import { Column, Link, Row, Section, Text } from "react-email";
import { demoHackathon } from "@/lib/data";
import {
  Badge,
  Block,
  Divider,
  EmailShell,
  Eyebrow,
  LinkFallback,
  LipButton,
  Paragraph,
  PixelGlyph,
  SectionTitle,
  Stat,
  Tile,
  Title,
  type EmailHackathon,
} from "./_components/shell";
import { accentTokens, fonts, palette } from "./_components/theme";

// To the hackathon's owner (src/workflows/judging-phase.ts). Judging never
// moves on by itself; these say it's their turn to advance the phase:
//   • "done": every review for the phase is in.
//   • "due": the phase's days are up but reviews are still missing.
// The button opens the progress page, where closing the phase is confirmed.

type Ranked = { number: number; name: string; score: number | null };

export type OwnerUpdateEmailProps = {
  hackathon: EmailHackathon;
  variant: "done" | "due";
  /** e.g. "Group review". */
  phaseName: string;
  /** e.g. "round 1 of 2". */
  roundLabel: string;
  /** Name of the next phase, or null when this is the last one. */
  nextPhase: string | null;
  /** How many go through to the next phase; null on the last one. */
  advanceCount: number | null;
  reviews: { done: number; total: number };
  projects: number;
  /** The current top of the phase ranking, best first. */
  leaders: Ranked[];
  /** The few projects just under the cut line, best first, so a close call is visible. */
  belowCut?: Ranked[];
  /** Judges with reviews left, most first ("due" only). */
  behind: { name: string; left: number }[];
  /** Things to decide before moving on, e.g. "2 gate failures need your call". */
  attention: string[];
  /** Opens the agent-failed inbox (/h/<slug>/judging/progress?inbox=open), linked from `attention`. */
  inboxUrl?: string;
  /** Full URL of the progress page. */
  progressUrl: string;
  /** 0 for the first email, then 1, 2… for reminders. */
  reminder: number;
};

/** A play arrow for the phase that's next ("▶" turns into an emoji on some phones). */
const NEXT = ["#....", "###..", "#####", "###..", "#...."];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const projectNumber = (n: number) => `#${String(n).padStart(3, "0")}`;

export const ownerUpdateSubject = (
  hackathon: Pick<EmailHackathon, "name">,
  { variant, phaseName, nextPhase, reminder }: Pick<OwnerUpdateEmailProps, "variant" | "phaseName" | "nextPhase" | "reminder">,
) =>
  `${reminder ? "Reminder: " : ""}${
    variant === "due"
      ? `${phaseName} is due, with reviews missing`
      : `${phaseName} is judged: ready to ${nextPhase ? `advance to ${nextPhase}` : "lock the results"}`
  } · ${hackathon.name}`;

export default function OwnerUpdateEmail({
  hackathon,
  variant,
  phaseName,
  roundLabel,
  nextPhase,
  advanceCount,
  reviews,
  projects,
  leaders,
  belowCut = [],
  behind,
  attention,
  inboxUrl,
  progressUrl,
  reminder,
}: OwnerUpdateEmailProps) {
  const t = accentTokens(hackathon.color);
  const done = variant === "done";
  const missing = reviews.total - reviews.done;
  const going = nextPhase ? (advanceCount ?? leaders.length) : null;
  // The whole top group is listed, so the cut line sits right under it.
  const cutShown = going !== null && leaders.length >= going;
  const tie =
    cutShown && belowCut[0]?.score != null && belowCut[0].score === leaders[going - 1]?.score;

  const intro = done
    ? `Every review for ${phaseName} is in. Nothing moves on until you say so.`
    : `${phaseName}'s judging days are up, but ${plural(missing, "review is", "reviews are")} still missing. Judges who are behind just got a last-call email. You can wait for them, or close the phase now with what's in.`;
  const next = nextPhase
    ? `Closing ${phaseName} sends the top ${going} to ${nextPhase}, and its judges get their links. The rest are out.`
    : `Closing ${phaseName} locks the final ranking. Then pick when to email the winners and everyone else.`;

  return (
    <EmailShell
      hackathon={hackathon}
      preview={
        done
          ? nextPhase
            ? `${phaseName} is done. The top ${going} are ready to move on to ${nextPhase}.`
            : `${phaseName} is done. The final ranking is ready for you to lock.`
          : `${plural(missing, "review")} missing in ${phaseName}.`
      }
      footerNote={`You're getting this because you run ${hackathon.name}. Change where these go in Setup › General.`}
    >
      <Eyebrow color={t.accent}>
        {hackathon.name} · {roundLabel}
      </Eyebrow>
      <Title style={{ marginTop: 12 }}>
        {reminder ? "Still waiting on you: " : ""}
        {done ? (nextPhase ? `Ready to advance to ${nextPhase}` : "Ready to lock the results") : `${phaseName} is due`}
      </Title>
      <Paragraph style={{ marginTop: 16 }}>{intro}</Paragraph>

      <PhasePath
        color={hackathon.color}
        done={done}
        from={{ name: phaseName, detail: done ? `${reviews.done}/${reviews.total} reviews in` : `${plural(missing, "review")} missing` }}
        to={nextPhase ? { name: nextPhase, detail: `Top ${going} go through` } : { name: "Final results", detail: "Winners locked in" }}
      />

      <Row style={{ marginTop: 14 }}>
        <Stat value={reviews.done} unit={`/${reviews.total}`} label="reviews in" style={{ paddingRight: 8 }} />
        <Stat value={projects} label={projects === 1 ? "project" : "projects"} style={{ padding: "0 4px" }} />
        <Stat value={going ?? leaders.length} label={nextPhase ? "advance" : "ranked"} style={{ paddingLeft: 8 }} />
      </Row>

      {attention.length > 0 && (
        <Section style={{ marginTop: 24, padding: "14px 18px", backgroundColor: palette.warningSoft, borderRadius: 10 }}>
          <Eyebrow color={palette.warning}>Needs your call first</Eyebrow>
          {attention.map((line) => (
            <Text key={line} style={{ margin: "6px 0 0", fontSize: 15, lineHeight: "22px" }}>
              {line}
            </Text>
          ))}
          {inboxUrl && (
            <Text style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px" }}>
              <Link href={inboxUrl} style={{ color: palette.warning, fontWeight: 600, textDecoration: "none" }}>
                Open the inbox&nbsp;→
              </Link>
            </Text>
          )}
        </Section>
      )}

      <Paragraph style={{ marginTop: 24 }}>{next}</Paragraph>
      <Section style={{ marginTop: 20 }}>
        <LipButton href={progressUrl} color={hackathon.color}>
          {done ? (nextPhase ? `Review & advance` : "Review & lock results") : `Review ${phaseName}`}&nbsp;&nbsp;→
        </LipButton>
      </Section>

      {leaders.length > 0 && (
        <>
          <Divider />
          <SectionTitle hint="right now">Current ranking</SectionTitle>
          <Block>
            {leaders.map((p, i) => (
              <RankRow key={p.number} place={i + 1} project={p} first={i === 0} color={hackathon.color} />
            ))}
            {going !== null && !cutShown && (
              <Section style={{ borderTop: `1px solid ${palette.border}`, padding: "10px 16px" }}>
                <Text style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: palette.muted }}>
                  …and {going - leaders.length} more go through
                </Text>
              </Section>
            )}
            {cutShown && (
              <Section
                style={{
                  borderTop: `2px dashed ${tie ? palette.warning : t.accent}`,
                  padding: "8px 16px",
                  backgroundColor: tie ? palette.warningSoft : t.accentSoft,
                }}
              >
                <Text
                  style={{
                    margin: 0,
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    lineHeight: "16px",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: tie ? palette.warning : t.accentSoftForeground,
                  }}
                >
                  {tie ? "▲ Tie at the cut line: decide who goes through" : `▲ Top ${going} go through to ${nextPhase}`}
                </Text>
              </Section>
            )}
            {cutShown &&
              belowCut.map((p, i) => (
                <RankRow key={p.number} place={going + i + 1} project={p} first={i === 0} color={hackathon.color} out />
              ))}
          </Block>
        </>
      )}

      {behind.length > 0 && (
        <>
          <Divider />
          <SectionTitle hint="reviews left">Still judging</SectionTitle>
          <Block>
            {behind.map((j, i) => (
              <Section
                key={j.name}
                style={{ padding: "11px 16px", borderTop: i === 0 ? undefined : `1px solid ${palette.border}` }}
              >
                <Row>
                  <Column style={{ fontSize: 15, lineHeight: "22px" }}>{j.name}</Column>
                  <Column align="right" style={{ width: 90 }}>
                    <Badge tone="warning">{plural(j.left, "left", "left")}</Badge>
                  </Column>
                </Row>
              </Section>
            ))}
          </Block>
        </>
      )}

      <Divider />
      <LinkFallback href={progressUrl} />
    </EmailShell>
  );
}

/** Where judging is: the phase that just finished, and where closing it leads. */
function PhasePath({
  color,
  done,
  from,
  to,
}: {
  color: string;
  done: boolean;
  from: { name: string; detail: string };
  to: { name: string; detail: string };
}) {
  const t = accentTokens(color);
  const step = (tile: ReactNode, s: { name: string; detail: string }) => (
    <>
      <Column style={{ width: 44, verticalAlign: "middle" }}>{tile}</Column>
      <Column style={{ verticalAlign: "middle" }}>
        <Text style={{ margin: 0, fontFamily: fonts.pixel, fontSize: 15, lineHeight: "20px", fontWeight: 600 }}>{s.name}</Text>
        <Text style={{ margin: "2px 0 0", fontSize: 13, lineHeight: "18px", color: palette.muted }}>{s.detail}</Text>
      </Column>
    </>
  );
  return (
    <Section style={{ marginTop: 24, padding: "14px 16px", backgroundColor: palette.surfaceSecondary, borderRadius: 12 }}>
      <Row>
        {step(
          done ? (
            <Tile size={32} background={t.accent} color={t.accentForeground} lip={t.accentLip} fontSize={15}>
              ✓
            </Tile>
          ) : (
            <Tile size={32} background={palette.warningSoft} color={palette.warning} fontSize={15}>
              !
            </Tile>
          ),
          from,
        )}
        <Column style={{ width: 36, verticalAlign: "middle", textAlign: "center", color: palette.muted, fontSize: 18 }}>→</Column>
        {step(
          <Tile size={32} background={palette.surface} color={t.accent} fontSize={15}>
            <PixelGlyph rows={NEXT} color={t.accent} cell={3} />
          </Tile>,
          to,
        )}
      </Row>
    </Section>
  );
}

/** One place in the ranking; `out` greys out projects under the cut line. */
function RankRow({
  place,
  project: p,
  first,
  color,
  out,
}: {
  place: number;
  project: Ranked;
  first: boolean;
  color: string;
  out?: boolean;
}) {
  const t = accentTokens(color);
  return (
    <Section style={{ borderTop: first ? undefined : `1px solid ${palette.border}`, padding: "10px 16px" }}>
      <Row>
        <Column style={{ width: 40, verticalAlign: "middle" }}>
          <Tile
            size={28}
            background={out ? palette.surfaceSecondary : t.accentSoft}
            color={out ? palette.muted : t.accentSoftForeground}
            fontSize={place > 99 ? 10 : 13}
          >
            {place}
          </Tile>
        </Column>
        <Column style={{ verticalAlign: "middle", fontSize: 15, lineHeight: "22px", color: out ? palette.muted : palette.foreground }}>
          {p.name}
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: palette.muted }}>&nbsp;&nbsp;{projectNumber(p.number)}</span>
        </Column>
        <Column
          align="right"
          style={{ width: 70, verticalAlign: "middle", fontFamily: fonts.pixel, fontSize: 16, color: out ? palette.muted : palette.foreground }}
        >
          {p.score === null ? <Badge>no score</Badge> : p.score.toFixed(1)}
        </Column>
      </Row>
    </Section>
  );
}

OwnerUpdateEmail.PreviewProps = {
  hackathon: demoHackathon,
  variant: "done",
  phaseName: "Group review",
  roundLabel: "round 1 of 2",
  nextPhase: "Final panel",
  advanceCount: 5,
  reviews: { done: 224, total: 224 },
  projects: 112,
  leaders: [
    { number: 12, name: "Ledgerly", score: 8.3 },
    { number: 88, name: "Nightshift", score: 8.2 },
    { number: 58, name: "Tripwire", score: 7.8 },
    { number: 47, name: "Repo Whisperer", score: 7.2 },
    { number: 63, name: "Pocket QA", score: 7.0 },
  ],
  belowCut: [
    { number: 91, name: "Cartographer", score: 6.9 },
    { number: 19, name: "Standup Bot", score: 6.6 },
  ],
  behind: [],
  attention: ["2 projects failed a must-pass check and need your call."],
  inboxUrl: "https://roundzero.dev/h/ai-agents-2026/judging/progress?inbox=open",
  progressUrl: "https://roundzero.dev/h/ai-agents-2026/judging/progress",
  reminder: 0,
} satisfies OwnerUpdateEmailProps;
