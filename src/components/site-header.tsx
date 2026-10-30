import Link from "next/link";
import { brand } from "@/lib/branding";
import { DEMO_MODE } from "@/lib/demo";
import { BrandMark } from "./brand-mark";
import { ButtonLink, cn } from "./ui";

/**
 * Header for the public pages — the landing page and the docs. Static (no
 * session lookup): /login sends signed-in visitors straight on to the app.
 */
export function SiteHeader({ section, className }: { section?: "docs"; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-30 border-b-2 border-border bg-background/90 backdrop-blur", className)}>
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="size-10" badgeClassName="lip bg-accent text-sm text-accent-foreground" />
          <span className="font-pixel text-xl font-bold">{brand.name}</span>
        </Link>
        {section === "docs" && (
          <>
            <span className="text-border-secondary">/</span>
            <Link href="/docs" className="font-pixel text-lg text-muted transition hover:text-foreground">
              Docs
            </Link>
          </>
        )}
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {section !== "docs" && (
            <Link
              href="/docs"
              className="rounded-lg px-3 py-2 text-[15px] font-semibold text-muted transition hover:bg-surface-secondary hover:text-foreground"
            >
              Docs
            </Link>
          )}
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-[15px] font-semibold text-muted transition hover:bg-surface-secondary hover:text-foreground sm:block"
          >
            Sign in
          </Link>
          {/* /signup makes a demo account while DEMO_MODE is on, and shows the admin setup steps otherwise. */}
          <ButtonLink href="/signup" size="sm">
            {DEMO_MODE ? "Try the demo" : "Get started"}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
