import { Column, Link, Row, Section, Text } from "react-email";
import type { RewardItem, RewardKind } from "@/lib/data";
import { accentTokens, fonts, palette } from "./theme";

// Reward pieces shared by the winner email and the thank-you gift.

export const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
};

/** The app's gift icon, for prizes without an image. Draw with PixelGlyph. */
export const GIFT = [
  ".##...##.",
  "#..#.#..#",
  "#########",
  "#########",
  ".#..#..#.",
  ".#..#..#.",
  ".#..#..#.",
  ".#######.",
];

export const HEART = [
  ".##.##.",
  "#######",
  "#######",
  ".#####.",
  "..###..",
  "...#...",
];

const kindLabel: Record<RewardKind, string> = {
  cash: "Cash",
  credits: "Credits",
  link: "Link",
  code: "Code",
  text: "Note",
  image: "Image",
  file: "File",
  swag: "Swag",
};

/** One line of a reward: its kind, its label, and a code to copy or a link to open. */
export function RewardItemRow({ item, color, first }: { item: RewardItem; color: string; first?: boolean }) {
  const t = accentTokens(color);
  return (
    <Section style={{ borderTop: first ? undefined : `1px solid ${palette.border}`, padding: "12px 18px" }}>
      <Row>
        <Column style={{ width: 72, verticalAlign: "top", paddingTop: 2 }}>
          <span
            style={{
              display: "inline-block",
              padding: "2px 6px",
              borderRadius: 6,
              backgroundColor: t.accentSoft,
              color: t.accentSoftForeground,
              fontFamily: fonts.mono,
              fontSize: 10,
              lineHeight: "16px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {kindLabel[item.kind]}
          </span>
        </Column>
        <Column style={{ verticalAlign: "top" }}>
          <Text style={{ margin: 0, fontSize: 15, lineHeight: "22px" }}>{item.label}</Text>
          <RewardDetail kind={item.kind} detail={item.detail} color={t.accent} />
        </Column>
      </Row>
    </Section>
  );
}

/** The redeemable part of a reward: a code to copy, or a link to open. */
function RewardDetail({ kind, detail, color }: { kind: RewardKind; detail: string; color: string }) {
  if (!detail) return null;
  if (kind === "code" || kind === "credits") {
    return (
      <Text style={{ margin: "6px 0 0" }}>
        <code
          style={{
            display: "inline-block",
            padding: "4px 10px",
            border: `1px dashed ${palette.borderStrong}`,
            borderRadius: 6,
            backgroundColor: palette.surfaceSecondary,
            fontFamily: fonts.mono,
            fontSize: 14,
            lineHeight: "20px",
            letterSpacing: "0.04em",
            wordBreak: "break-all",
          }}
        >
          {detail}
        </code>
      </Text>
    );
  }
  if (kind === "link" || kind === "file" || kind === "image") {
    return (
      <Text style={{ margin: "2px 0 0", fontSize: 14, lineHeight: "20px" }}>
        <Link href={detail} style={{ color, fontWeight: 500, textDecoration: "none" }}>
          {kind === "file" ? "Download" : "Open"}&nbsp;→
        </Link>
      </Text>
    );
  }
  return null;
}
