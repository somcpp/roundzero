import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { Eyebrow, LogoMark, PixelCover } from "@/components/ui";
import { brand } from "@/lib/branding";
import { initials } from "@/lib/format-hackathon";
import { hackathonBannerUrl } from "@/lib/hackathon-banners";
import { hackathonLogoUrl } from "@/lib/hackathon-logos";
import { IntakeUnavailableError, getIntakeTarget, type IntakeTarget } from "@/lib/intake";
import { SubmissionForm } from "./submission-form";

// The public submission form, switched on from Judging › Projects › Submission
// form. Posts to /api/intake with the token from the URL.

async function load(token: string): Promise<IntakeTarget | "closed" | "unavailable"> {
  try {
    return (await getIntakeTarget("form", token)) ?? "closed";
  } catch (e) {
    if (e instanceof IntakeUnavailableError) return "unavailable";
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/f/[token]">): Promise<Metadata> {
  const { token } = await params;
  const target = await load(token);
  return {
    title: typeof target === "string" ? "Submit a project" : `Submit a project — ${target.hackathon.name}`,
    robots: { index: false },
  };
}

export default async function SubmitPage({ params }: PageProps<"/f/[token]">) {
  const { token } = await params;
  const target = await load(token);

  if (typeof target === "string") {
    return (
      <Shell>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
          <span className="grid size-14 place-items-center rounded-xl bg-surface-secondary text-muted">
            <PixelIcon name="lock" size={24} />
          </span>
          <h1 className="text-3xl">Submissions are closed</h1>
          <p className="text-muted">
            {target === "closed"
              ? "This form isn't taking projects right now. Check with the organizers for the current link."
              : "This form isn't available yet. Check back soon."}
          </p>
        </main>
      </Shell>
    );
  }

  const { hackathon, blocks } = target;
  return (
    <Shell color={hackathon.color}>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-8">
          <LogoMark
            text={hackathon.logo || initials(hackathon.name) || "?"}
            src={hackathonLogoUrl(hackathon.logo_path)}
            color={hackathon.color}
            size={28}
          />
          <span className="truncate font-pixel text-base">{hackathon.name}</span>
        </div>
      </header>

      <PixelCover
        seed={`${hackathon.slug}-submit`}
        color={hackathon.color}
        image={hackathonBannerUrl(hackathon.banner_path ?? null)}
        className="border-b border-border"
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-14 text-center sm:px-8">
          <span className="rounded bg-surface/90 px-2 py-1">
            <Eyebrow className="text-accent">Project submission</Eyebrow>
          </span>
          <h1 className="rounded-md bg-surface/90 px-4 py-2 text-3xl leading-tight sm:text-4xl">{hackathon.name}</h1>
          {hackathon.tagline && <p className="rounded bg-surface/90 px-3 py-1 text-sm text-muted">{hackathon.tagline}</p>}
        </div>
      </PixelCover>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-8">
        <SubmissionForm token={token} blocks={blocks} />
      </main>
    </Shell>
  );
}

function Shell({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <div className="brand flex min-h-screen flex-col" style={color ? ({ "--brand": color } as CSSProperties) : undefined}>
      {children}
      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        Judged with{" "}
        <Link href="/" className="font-pixel text-foreground">
          {brand.name}
        </Link>
      </footer>
    </div>
  );
}
