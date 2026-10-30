import { Column, Link, Row, Section, Text } from "react-email";
import {
  THANK_YOU_EMAIL_DEFAULTS,
  demoHackathon,
  emptyThankYouEmail,
  fillEmailCopy,
  type ThankYouEmailSettings,
} from "@/lib/data";
import { GIFT, HEART, RewardItemRow, ordinal } from "./_components/rewards";
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

// Sent to every project that didn't win once results are out: thanks for
// building it, how far it got, who won, and an optional thank-you gift for
// everyone who took part. Winners get emails/winner.tsx instead.

export type ThankYouEmailProps = {
  hackathon: EmailHackathon;
  email: ThankYouEmailSettings;
  project: {
    name: string;
    /** Judges who reviewed it. */
    reviews: number;
    /** How far it got, e.g. "Reached round 2 of 2"; null leaves it out. */
    milestone: string | null;
  };
  stats: { projects: number; judges: number; reviews: number };
  /** Every winner, in the order the results list them: ranked places, then awards. */
  winners: { id: string; name: string; pitch: string; rank: number | null; prize: string }[];
  /** Full URL of the public winners page. */
  winnersUrl: string;
};

/** Winners listed in the email; the rest are a link away. */
const MAX_WINNERS = 6;

export const thankYouSubject = (
  email: Pick<ThankYouEmailSettings, "subject">,
  hackathon: Pick<EmailHackathon, "name">,
  project: string,
) => fillEmailCopy(email.subject || THANK_YOU_EMAIL_DEFAULTS.subject, { project, hackathon: hackathon.name, rank: null });

export default function ThankYouEmail({ hackathon, email, project, stats, winners, winnersUrl }: ThankYouEmailProps) {
  const t = accentTokens(hackathon.color);
  const fill = (text: string) => fillEmailCopy(text, { project: project.name, hackathon: hackathon.name, rank: null });
  const from = email.fromName || hackathon.name;
  const showWinners = email.showWinners && winners.length > 0;
  const shown = winners.slice(0, MAX_WINNERS);
  const gift = email.giftItems.length > 0;

  return (
    <EmailShell
      hackathon={hackathon}
      preview={`${showWinners ? `The ${hackathon.name} winners are in. ` : ""}Thank you for building ${project.name}${
        gift ? ", plus a little something for you." : "."
      }`}
      footerNote={`You're getting this because ${project.name} was submitted to ${hackathon.name}.`}
    >
      <Eyebrow color={t.accent}>{hackathon.name} · Results are in</Eyebrow>
      <Title style={{ marginTop: 12 }}>{fill(email.title || THANK_YOU_EMAIL_DEFAULTS.title)}</Title>
      <Paragraph style={{ marginTop: 16 }}>{fill(email.message || THANK_YOU_EMAIL_DEFAULTS.message)}</Paragraph>

      <Block style={{ marginTop: 24, backgroundColor: t.accentSoft, borderColor: t.accentSoft, borderBottomColor: t.accentSoftLip }}>
        <Section style={{ padding: "16px 18px" }}>
          <Row>
            <Column style={{ width: 68, verticalAlign: "middle" }}>
              <Tile size={52} background={palette.surface} color={t.accent} fontSize={16}>
                <PixelGlyph rows={HEART} color={t.accent} cell={4} />
              </Tile>
            </Column>
            <Column style={{ verticalAlign: "middle" }}>
              <Eyebrow color={t.accentSoftForeground}>Your project</Eyebrow>
              <Text style={{ margin: "4px 0 0", fontFamily: fonts.pixel, fontSize: 19, lineHeight: "24px", fontWeight: 600 }}>
                {project.name}
              </Text>
              {(project.reviews > 0 || project.milestone) && (
                <Text style={{ margin: "4px 0 0", fontSize: 14, lineHeight: "22px", color: t.accentSoftForeground }}>
                  {project.reviews > 0 && `Reviewed by ${project.reviews} ${project.reviews === 1 ? "judge" : "judges"}`}
                  {project.reviews > 0 && project.milestone && <>&nbsp;&nbsp;</>}
                  {project.milestone && <Badge>{project.milestone}</Badge>}
                </Text>
              )}
            </Column>
          </Row>
        </Section>
      </Block>

      <Row style={{ marginTop: 14 }}>
        <Stat value={stats.projects} label="projects" style={{ paddingRight: 8 }} />
        <Stat value={stats.judges} label="judges" style={{ padding: "0 4px" }} />
        <Stat value={stats.reviews} label="reviews" style={{ paddingLeft: 8 }} />
      </Row>

      {showWinners && (
        <>
          <Divider />
          <SectionTitle>And the winners are…</SectionTitle>
          <Block>
            {shown.map((w, i) => {
              const place = w.rank ? ordinal(w.rank) : "★";
              const top = w.rank === 1;
              return (
                <Section key={w.id} style={{ padding: "14px 16px", borderTop: i === 0 ? undefined : `1px solid ${palette.border}` }}>
                  <Row>
                    <Column style={{ width: 58, verticalAlign: "top" }}>
                      <Tile
                        size={44}
                        background={top ? t.accent : t.accentSoft}
                        color={top ? t.accentForeground : t.accentSoftForeground}
                        lip={top ? t.accentLip : undefined}
                        fontSize={place.length > 3 ? 13 : 16}
                      >
                        {place}
                      </Tile>
                    </Column>
                    <Column style={{ verticalAlign: "top" }}>
                      <Text style={{ margin: 0, fontFamily: fonts.pixel, fontSize: 16, lineHeight: "22px", fontWeight: 600 }}>
                        {w.name}
                      </Text>
                      <Text style={{ margin: "1px 0 0", fontSize: 13, lineHeight: "19px", fontWeight: 500, color: t.accent }}>
                        {w.prize}
                      </Text>
                      {w.pitch && (
                        <Text style={{ margin: "2px 0 0", fontSize: 14, lineHeight: "20px", color: palette.muted }}>{w.pitch}</Text>
                      )}
                    </Column>
                  </Row>
                </Section>
              );
            })}
          </Block>
          <Text style={{ margin: "14px 0 0", fontSize: 14, lineHeight: "21px" }}>
            <Link href={winnersUrl} style={{ color: t.accent, fontWeight: 500, textDecoration: "none" }}>
              {winners.length > shown.length ? `See all ${winners.length} winners` : "See the winning projects"}&nbsp;→
            </Link>
          </Text>
        </>
      )}

      {gift && (
        <>
          <Divider />
          <Section
            style={{
              padding: "22px 20px 20px",
              backgroundColor: t.accentSoft,
              border: `2px dashed ${t.accent}`,
              borderRadius: 16,
            }}
          >
            <Row>
              <Column style={{ width: 72, verticalAlign: "top" }}>
                <Tile size={56} background={palette.surface} color={t.accent} lip={t.accentSoftLip} fontSize={16}>
                  <PixelGlyph rows={GIFT} color={t.accent} cell={4} />
                </Tile>
              </Column>
              <Column style={{ verticalAlign: "top" }}>
                <Eyebrow color={t.accentSoftForeground}>A thank-you gift</Eyebrow>
                <Text style={{ margin: "6px 0 0", fontFamily: fonts.pixel, fontSize: 20, lineHeight: "26px", fontWeight: 600 }}>
                  {email.giftTitle || THANK_YOU_EMAIL_DEFAULTS.giftTitle}
                </Text>
                {email.giftDescription && (
                  <Text style={{ margin: "4px 0 0", fontSize: 14, lineHeight: "21px", color: t.accentSoftForeground }}>
                    {email.giftDescription}
                  </Text>
                )}
              </Column>
            </Row>
            <Block style={{ marginTop: 16 }}>
              {email.giftItems.map((it, i) => (
                <RewardItemRow key={it.id} item={it} color={hackathon.color} first={i === 0} />
              ))}
            </Block>
          </Section>
        </>
      )}

      {email.finePrint && (
        <Paragraph muted style={{ marginTop: 16, fontSize: 13, lineHeight: "20px" }}>
          {email.finePrint}
        </Paragraph>
      )}

      {email.linkUrl && (
        <Section style={{ marginTop: 28 }}>
          <LipButton href={email.linkUrl} color={hackathon.color}>
            {email.linkLabel || THANK_YOU_EMAIL_DEFAULTS.linkLabel}&nbsp;&nbsp;→
          </LipButton>
        </Section>
      )}

      <Divider />
      <Paragraph>Keep building. We hope to see you at the next one.</Paragraph>
      <Text style={{ margin: "6px 0 0", fontSize: 16, lineHeight: "24px", color: palette.muted }}>— {from}</Text>
      {email.linkUrl && (
        <Section style={{ marginTop: 24 }}>
          <LinkFallback href={email.linkUrl} />
        </Section>
      )}
    </EmailShell>
  );
}

ThankYouEmail.PreviewProps = {
  hackathon: demoHackathon,
  email: {
    ...emptyThankYouEmail,
    fromName: "The AI Agents Hack team",
    giftTitle: "$50 in credits for every team",
    giftDescription: "Everyone who shipped a project gets these, win or not. Thanks for building with us.",
    giftItems: [
      { id: "credits", kind: "credits", label: "$50 in Acme API credits", detail: "THANKS-AAH26-M4K9" },
      { id: "pro", kind: "link", label: "3 months of Acme Pro, free", detail: "https://acme.dev/pro?promo=aah26" },
      { id: "stickers", kind: "swag", label: "Sticker pack, shipped anywhere", detail: "" },
    ],
    linkUrl: "https://lu.ma/acme-demo-night",
    linkLabel: "RSVP for demo night",
    finePrint: "Credits expire 90 days after you redeem them. One code per team.",
  },
  project: { name: "Menu Mind", reviews: 3, milestone: "Reached round 2 of 2" },
  stats: { projects: 112, judges: 10, reviews: 236 },
  winners: [
    { id: "047", name: "Repo Whisperer", pitch: "Ask any codebase anything", rank: 1, prize: "Grand prize" },
    { id: "012", name: "Ledgerly", pitch: "Agentic bookkeeping for indie devs", rank: 2, prize: "2nd place + Best demo video" },
    { id: "088", name: "Nightshift", pitch: "Overnight agent that fixes flaky tests", rank: 3, prize: "3rd place + Best use of Acme SDK" },
    { id: "058", name: "Tripwire", pitch: "Agent that watches prod and files good bugs", rank: null, prize: "Community pick" },
  ],
  winnersUrl: `https://roundzero.dev/w/${demoHackathon.slug}`,
} satisfies ThankYouEmailProps;
