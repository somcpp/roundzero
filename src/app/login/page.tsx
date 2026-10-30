import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { Panel, TextLink } from "@/components/ui";
import { brand } from "@/lib/branding";
import { DEMO_LOGIN, DEMO_MODE } from "@/lib/demo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `Sign in — ${brand.name}` };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="grid flex-1 place-items-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark className="size-14 rounded-xl" badgeClassName="lip bg-accent text-lg text-accent-foreground" />
          <div className="flex flex-col gap-2">
            <h1 className="font-pixel text-3xl leading-none">Sign in to {brand.name}</h1>
            <p className="text-muted">{DEMO_MODE ? "Try the demo, or sign in as an admin." : "Admin access only."}</p>
          </div>
        </div>
        <Panel className="p-7">
          <LoginForm next={typeof next === "string" ? next : undefined} demo={DEMO_MODE ? DEMO_LOGIN : undefined} />
        </Panel>
        <p className="text-center text-[15px] text-muted">
          {DEMO_MODE ? (
            <>
              Want your own?{" "}
              <TextLink href="/docs/reference/deployment" target="_blank" rel="noreferrer">
                Self-host {brand.name}
              </TextLink>
            </>
          ) : (
            <>
              No account? <TextLink href="/signup">Sign up</TextLink>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
