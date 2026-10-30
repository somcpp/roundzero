import type { CSSProperties, ReactNode } from "react";
import { Body, Button, Column, Container, Font, Head, Heading, Html, Img, Link, Preview, Section, Text } from "react-email";
import { brand } from "@/lib/branding";
import type { Hackathon } from "@/lib/data";
import { accentTokens, coverCells, fontFiles, fonts, mix, palette } from "./theme";

// The frame every RoundZero email shares: the hackathon's pixel cover and logo
// on a chunky card, then a "Judged with" footer. Tables and inline styles
// throughout, since that's what Gmail and Outlook render.

export type EmailHackathon = Pick<Hackathon, "name" | "slug" | "logo" | "logoUrl" | "color">;

type Tokens = ReturnType<typeof accentTokens>;

export function EmailShell({
  hackathon,
  preview,
  footerNote,
  children,
}: {
  hackathon: EmailHackathon;
  /** The inbox preview line. */
  preview: string;
  /** Why the reader got this, under the brand line. */
  footerNote: string;
  children: ReactNode;
}) {
  const t = accentTokens(hackathon.color);
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        {/* Each <Font> also sets `* { font-family }`, so the body face goes last. */}
        <Font fontFamily="Geist Pixel" fallbackFontFamily="monospace" webFont={{ url: fontFiles.pixel, format: "woff2" }} fontWeight={600} />
        {([400, 500, 600] as const).map((w) => (
          <Font
            key={w}
            fontFamily="Geist"
            fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
            webFont={{ url: fontFiles.sans(w), format: "woff2" }}
            fontWeight={w}
          />
        ))}
        <style>{"@media only screen and (max-width: 480px) { .card-body { padding: 28px 20px 32px !important; } }"}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: palette.background, color: palette.foreground, fontFamily: fonts.sans }}>
        <Container style={{ maxWidth: 580, padding: "32px 12px 40px" }}>
          <Section
            style={{
              backgroundColor: palette.surface,
              border: `2px solid ${palette.border}`,
              borderBottomWidth: 6,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <PixelCover hackathon={hackathon} t={t} />
            <Section tdClassName="card-body" style={{ padding: "36px 36px 40px" }}>
              {children}
            </Section>
          </Section>
          <Footer note={footerNote} />
        </Container>
      </Body>
    </Html>
  );
}

// ── Cover ─────────────────────────────────────────────────────────────────

const ROW = 10;
/** The clearing in the pattern the logo sits in: columns and rows of the 24×12 grid. */
const WINDOW = { x: 9, y: 2, w: 6, h: 8 };

/** The hackathon's pixel cover as a table of colored cells, since email clients drop inline SVG. */
function PixelCover({ hackathon, t }: { hackathon: EmailHackathon; t: Tokens }) {
  const { W, H, cells } = coverCells(hackathon.slug);
  const fill = new Map(cells.map((c) => [`${c.x},${c.y}`, mix(t.coverBackground, t.accent, c.o * 0.55)]));
  const inWindow = (x: number, y: number) =>
    x >= WINDOW.x && x < WINDOW.x + WINDOW.w && y >= WINDOW.y && y < WINDOW.y + WINDOW.h;

  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ tableLayout: "fixed", backgroundColor: t.coverBackground, borderCollapse: "collapse" }}
    >
      <tbody>
        {Array.from({ length: H }, (_, y) => (
          <tr key={y}>
            {Array.from({ length: W }, (_, x) => {
              if (x === WINDOW.x && y === WINDOW.y) {
                return (
                  <td key={x} colSpan={WINDOW.w} rowSpan={WINDOW.h} align="center" valign="middle">
                    <LogoMark hackathon={hackathon} t={t} size={60} />
                  </td>
                );
              }
              if (inWindow(x, y)) return null;
              const bg = fill.get(`${x},${y}`);
              return (
                <td
                  key={x}
                  height={x === 0 ? ROW : undefined}
                  style={{
                    width: y === 0 ? `${100 / W}%` : undefined,
                    height: x === 0 ? ROW : undefined,
                    backgroundColor: bg,
                    fontSize: 0,
                    lineHeight: 0,
                  }}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The uploaded logo, or its initials on the hackathon color with a pressable lip. */
function LogoMark({ hackathon, t, size }: { hackathon: EmailHackathon; t: Tokens; size: number }) {
  if (hackathon.logoUrl) {
    return <Img src={hackathon.logoUrl} alt={hackathon.name} width={size} height={size} style={{ borderRadius: 12 }} />;
  }
  return (
    <Tile size={size} background={t.accent} color={t.accentForeground} lip={t.accentLip} fontSize={size * 0.38}>
      {hackathon.logo}
    </Tile>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────

/** A square with centered pixel text, e.g. a logo mark or a place. */
export function Tile({
  size,
  background,
  color,
  lip,
  fontSize,
  children,
}: {
  size: number;
  background: string;
  color: string;
  /** A darker bottom edge, like the app's filled controls. */
  lip?: string;
  fontSize: number;
  children: ReactNode;
}) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            width={size}
            height={size - (lip ? 4 : 0)}
            style={{
              width: size,
              height: size - (lip ? 4 : 0),
              backgroundColor: background,
              borderBottom: lip ? `4px solid ${lip}` : undefined,
              borderRadius: Math.round(size / 5),
              color,
              fontFamily: fonts.pixel,
              fontWeight: 600,
              fontSize,
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** A small bitmap ("#" filled, "." empty) drawn as table cells, for icons without SVG. */
export function PixelGlyph({ rows, color, cell }: { rows: string[]; color: string; cell: number }) {
  return (
    <table role="presentation" align="center" cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "collapse" }}>
      <tbody>
        {rows.map((row, y) => (
          <tr key={y}>
            {[...row].map((c, x) => (
              <td
                key={x}
                width={cell}
                height={cell}
                style={{ width: cell, height: cell, backgroundColor: c === "#" ? color : undefined, fontSize: 0, lineHeight: 0 }}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Eyebrow({ color = palette.muted, children }: { color?: string; children: ReactNode }) {
  return (
    <Text
      style={{
        margin: 0,
        fontFamily: fonts.mono,
        fontSize: 12,
        lineHeight: "16px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </Text>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: 0,
        fontFamily: fonts.pixel,
        fontSize: 30,
        lineHeight: "36px",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        color: palette.foreground,
        ...style,
      }}
    >
      {children}
    </Heading>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{ margin: "0 0 12px", fontFamily: fonts.pixel, fontSize: 18, lineHeight: "24px", fontWeight: 600, color: palette.foreground }}
    >
      {children}
      {hint && (
        <span style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 400, color: palette.muted }}>&nbsp;&nbsp;{hint}</span>
      )}
    </Heading>
  );
}

export function Paragraph({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: CSSProperties }) {
  return (
    <Text
      style={{
        margin: 0,
        fontSize: 16,
        lineHeight: "26px",
        color: muted ? palette.muted : palette.foreground,
        whiteSpace: "pre-line",
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** The main call to action: a filled button with the app's pressable bottom lip. */
export function LipButton({ href, color, children }: { href: string; color: string; children: ReactNode }) {
  const t = accentTokens(color);
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        padding: "14px 24px 12px",
        backgroundColor: t.accent,
        borderBottom: `4px solid ${t.accentLip}`,
        borderRadius: 12,
        color: t.accentForeground,
        fontFamily: fonts.sans,
        fontSize: 16,
        lineHeight: "20px",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}

/** A bordered panel sitting on the page, like the app's `Panel`. */
export function Block({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <Section
      style={{
        border: `2px solid ${palette.border}`,
        borderBottomWidth: 4,
        borderRadius: 12,
        backgroundColor: palette.surface,
        ...style,
      }}
    >
      {children}
    </Section>
  );
}

/** A number and what it counts, in a bordered tile. Put three in a Row; the column's padding is the gap between them. */
export function Stat({ value, unit, label, style }: { value: number; unit?: string; label: string; style: CSSProperties }) {
  return (
    <Column style={{ width: "33.33%", verticalAlign: "top", ...style }}>
      <Block style={{ padding: "14px 16px 12px" }}>
        <Text style={{ margin: 0, fontFamily: fonts.pixel, fontSize: 28, lineHeight: "32px", fontWeight: 600 }}>
          {value}
          {unit && <span style={{ fontSize: 14, color: palette.muted }}>{unit}</span>}
        </Text>
        <Text style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "18px", color: palette.muted }}>{label}</Text>
      </Block>
    </Column>
  );
}

/** A small uppercase label, like the app's `Badge`. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 6,
        backgroundColor: tone === "warning" ? palette.warningSoft : palette.surfaceSecondary,
        color: tone === "warning" ? palette.warning : palette.muted,
        fontFamily: fonts.mono,
        fontSize: 10,
        lineHeight: "16px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** For when the button doesn't click: the raw link, small and wrappable. */
export function LinkFallback({ href }: { href: string }) {
  return (
    <Text style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: palette.muted }}>
      Button not working? Paste this into your browser:
      <br />
      <Link href={href} style={{ color: palette.muted, textDecoration: "underline", wordBreak: "break-all" }}>
        {href}
      </Link>
    </Text>
  );
}

export function Divider() {
  return <Section style={{ borderTop: `2px dashed ${palette.border}`, margin: "32px 0" }} />;
}

function Footer({ note }: { note: string }) {
  return (
    <Section style={{ padding: "24px 8px 0", textAlign: "center" }}>
      <table role="presentation" align="center" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td valign="middle" style={{ paddingRight: 8 }}>
              {/* A logo in /public only works here once it's a full URL. */}
              {brand.logo?.startsWith("http") ? (
                <Img src={brand.logo} alt="" width={20} height={20} style={{ borderRadius: 5 }} />
              ) : (
                <Tile size={20} background={brand.color} color={brand.colorForeground} fontSize={9}>
                  {brand.badge}
                </Tile>
              )}
            </td>
            <td valign="middle" style={{ fontSize: 13, lineHeight: "20px", color: palette.muted }}>
              Judged with <span style={{ fontFamily: fonts.pixel, fontWeight: 600, color: palette.foreground }}>{brand.name}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <Text style={{ margin: "10px 0 0", fontSize: 12, lineHeight: "18px", color: palette.muted }}>{note}</Text>
    </Section>
  );
}
