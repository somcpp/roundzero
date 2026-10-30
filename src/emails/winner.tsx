import { Column, Img, Link, Row, Section, Text } from "react-email";
import {
  REWARD_EMAIL_DEFAULTS,
  demoHackathon,
  emptyRewardEmail,
  fillEmailCopy,
  type RewardEmail,
  type RewardTier,
} from "@/lib/data";
import { GIFT, RewardItemRow, ordinal } from "./_components/rewards";
import {
  Block,
  Divider,
  EmailShell,
  Eyebrow,
  LinkFallback,
  LipButton,
  Paragraph,
  PixelGlyph,
  SectionTitle,
  Tile,
  Title,
  type EmailHackathon,
} from "./_components/shell";
import { accentTokens, fonts, palette } from "./_components/theme";

// Sent to each winning project, listing every tier it collects. The copy comes
// from Judging › Rewards › Email, like the in-app preview in
// components/winner-email.tsx.

/** A tier as the email shows it, with its prize image already resolved to a public URL. */
export type EmailTier = Pick<RewardTier, "id" | "name" | "description" | "items"> & { imageUrl: string | null };

export type WinnerEmailProps = {
  hackathon: EmailHackathon;
  email: RewardEmail;
  projectName: string;
  /** Final rank, or null for award-only winners. */
  rank: number | null;
  /** How many projects were ranked. */
  total: number;
  tiers: EmailTier[];
  /** Full URL of the public winners page. */
  winnersUrl: string;
};

export const winnerSubject = (hackathon: Pick<EmailHackathon, "name">, tiers: Pick<EmailTier, "name">[]) =>
  `You won ${tiers[0]?.name ?? "a prize"} at ${hackathon.name} 🎉`;

export default function WinnerEmail({ hackathon, email, projectName, rank, total, tiers, winnersUrl }: WinnerEmailProps) {
  const t = accentTokens(hackathon.color);
  const fill = (copy: string) => fillEmailCopy(copy, { project: projectName, hackathon: hackathon.name, rank });
  const place = rank ? ordinal(rank) : "★";

  return (
    <EmailShell
      hackathon={hackathon}
      preview={`${projectName} won ${tiers.map((tier) => tier.name).join(" and ")} at ${hackathon.name}.`}
      footerNote={`You're getting this because ${projectName} won at ${hackathon.name}.`}
    >
      <Row>
        <Column style={{ width: 84, verticalAlign: "top" }}>
          <Tile
            size={68}
            background={t.accent}
            color={t.accentForeground}
            lip={t.accentLip}
            fontSize={place.length > 4 ? 16 : place.length > 3 ? 20 : 24}
          >
            {place}
          </Tile>
        </Column>
        <Column style={{ verticalAlign: "middle" }}>
          <Eyebrow color={t.accent}>{hackathon.name} · Results</Eyebrow>
          <Text style={{ margin: "6px 0 0", fontSize: 14, lineHeight: "20px", color: palette.muted }}>
            {rank ? `Final ranking · ${total} projects` : "Picked by the judges"}
          </Text>
        </Column>
      </Row>

      <Title style={{ marginTop: 24 }}>{fill(email.title || REWARD_EMAIL_DEFAULTS.title)}</Title>
      <Paragraph muted style={{ marginTop: 14 }}>
        {email.description ? (
          fill(email.description)
        ) : (
          <>
            {rank ? (
              <>
                Out of {total} finalists, the judges ranked yours <b style={{ color: palette.foreground }}>#{rank}</b>.
              </>
            ) : (
              <>The judges picked yours for {tiers.map((tier) => tier.name).join(" and ")}.</>
            )}{" "}
            Here&apos;s everything you&apos;ve earned:
          </>
        )}
      </Paragraph>

      <Section style={{ marginTop: 28 }}>
        <SectionTitle>{tiers.length === 1 ? "Your reward" : "Your rewards"}</SectionTitle>
        {tiers.map((tier, i) => (
          <Block key={tier.id} style={{ marginTop: i === 0 ? 0 : 14 }}>
            <Section style={{ padding: "16px 18px" }}>
              <Row>
                <Column style={{ width: 72, verticalAlign: "middle" }}>
                  {tier.imageUrl ? (
                    <Img
                      src={tier.imageUrl}
                      alt={tier.name}
                      width={56}
                      height={56}
                      style={{ borderRadius: 10, backgroundColor: palette.surfaceSecondary }}
                    />
                  ) : (
                    <Tile size={56} background={t.accentSoft} color={t.accentSoftForeground} fontSize={20}>
                      <PixelGlyph rows={GIFT} color={t.accent} cell={4} />
                    </Tile>
                  )}
                </Column>
                <Column style={{ verticalAlign: "middle" }}>
                  <Text style={{ margin: 0, fontFamily: fonts.pixel, fontSize: 17, lineHeight: "22px", fontWeight: 600 }}>
                    {tier.name}
                  </Text>
                  {tier.description && (
                    <Text style={{ margin: "2px 0 0", fontSize: 14, lineHeight: "20px", color: palette.muted }}>
                      {tier.description}
                    </Text>
                  )}
                </Column>
              </Row>
            </Section>
            {tier.items.map((it) => (
              <RewardItemRow key={it.id} item={it} color={hackathon.color} />
            ))}
          </Block>
        ))}
      </Section>

      {email.finePrint && (
        <Paragraph muted style={{ marginTop: 16, fontSize: 13, lineHeight: "20px" }}>
          {email.finePrint}
        </Paragraph>
      )}

      {email.linkUrl && (
        <Section style={{ marginTop: 32 }}>
          <LipButton href={email.linkUrl} color={hackathon.color}>
            {email.linkLabel || REWARD_EMAIL_DEFAULTS.linkLabel}&nbsp;&nbsp;→
          </LipButton>
        </Section>
      )}

      <Divider />
      <Text style={{ margin: 0, fontSize: 14, lineHeight: "21px", color: palette.muted }}>
        See every winner at{" "}
        <Link href={winnersUrl} style={{ color: t.accent, textDecoration: "underline" }}>
          {winnersUrl.replace(/^https?:\/\//, "")}
        </Link>
      </Text>
      {email.linkUrl && (
        <Section style={{ marginTop: 16 }}>
          <LinkFallback href={email.linkUrl} />
        </Section>
      )}
    </EmailShell>
  );
}

WinnerEmail.PreviewProps = {
  hackathon: demoHackathon,
  email: {
    ...emptyRewardEmail,
    linkUrl: "https://acme.dev/hackathon/claim",
    finePrint:
      "Cash prizes go out by bank transfer within 30 days. Reply to this email with the name and country of whoever should receive it.",
  },
  projectName: "Repo Whisperer",
  rank: 1,
  total: 112,
  tiers: [
    {
      id: "grand",
      name: "Grand prize",
      description: "Top project overall",
      imageUrl: null,
      items: [
        { id: "cash", kind: "cash", label: "$5,000 for the team", detail: "" },
        { id: "credits", kind: "credits", label: "$10,000 in Acme API credits", detail: "ACME-GRAND-7F3K-Q9" },
        { id: "call", kind: "link", label: "30 minutes with the Acme CTO", detail: "https://cal.com/acme/cto" },
      ],
    },
    {
      id: "sdk",
      name: "Best use of Acme SDK",
      description: "Deepest, most creative use of the SDK",
      imageUrl: null,
      items: [{ id: "hoodie", kind: "swag", label: "Limited-edition builder hoodie for everyone on the team", detail: "" }],
    },
  ],
  winnersUrl: `https://roundzero.dev/w/${demoHackathon.slug}`,
} satisfies WinnerEmailProps;
