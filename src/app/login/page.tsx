import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { Panel, TextLink } from "@/components/ui";
import { brand } from "@/lib/branding";
import { DEMO_LOGIN, DEMO_MODE } from "@/lib/demo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `Sign in — ${brand.name}` };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, demo } = await searchParams;
  // "Try the demo" links here with ?demo, which fills in the shared demo login.
  // Plain /login is the organizer sign-in.
  const showDemo = DEMO_MODE && demo !== undefined;

  return (
    <main className="grid flex-1 place-items-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark className="size-14 rounded-xl" badgeClassName="lip bg-accent text-lg text-accent-foreground" />
          <div className="flex flex-col gap-2">
            <h1 className="font-pixel text-3xl leading-none">Sign in to {brand.name}</h1>
            <p className="text-muted">{showDemo ? "Look around three sample hackathons." : "Organizer sign-in."}</p>
          </div>
        </div>
        <Panel className="p-7">
          <LoginForm next={typeof next === "string" ? next : undefined} demo={showDemo ? DEMO_LOGIN : undefined} />
        </Panel>
        <div className="flex flex-col gap-1 text-center text-[15px] text-muted">
          {showDemo ? (
            <p>
              Running a hackathon? <TextLink href="/login">Sign in as an organizer</TextLink>
            </p>
          ) : (
            <>
              {DEMO_MODE && (
                <p>
                  Just looking? <TextLink href="/login?demo">Try the demo</TextLink>
                </p>
              )}
              <p>Need an organizer account? Ask the {brand.name} team.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
