import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { GeistPixelSquare } from "geist/font/pixel";
import type { CSSProperties } from "react";
import { brand } from "@/lib/branding";
import { appUrl } from "@/lib/email/config";
import "./globals.css";

const description = "Run hackathons, judge with agents and humans, publish winners.";

// The share image itself is opengraph-image.png / twitter-image.png in this
// folder; metadataBase makes its URL absolute.
export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: brand.name,
  description,
  openGraph: { type: "website", siteName: brand.name, title: brand.name, description },
  twitter: { card: "summary_large_image", title: brand.name, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} h-full antialiased`}
      style={{ "--accent": brand.color, "--accent-foreground": brand.colorForeground } as CSSProperties}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
