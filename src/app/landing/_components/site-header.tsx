import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/branding";
import { GetStarted, TryDemo } from "./cta";

const NAV = [
  { href: "#why-hackathons", label: "Why hackathons" },
  { href: "#split", label: "How it works" },
  { href: "#stack", label: "Stack" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="nav-dark mx-auto flex max-w-5xl items-center gap-6 rounded-2xl border border-white/10 bg-[rgba(21,12,46,0.88)] py-2 pr-3 pl-4 text-[var(--on-dark)] shadow-[0_10px_34px_rgba(21,12,46,0.35)] backdrop-blur-md">
        <a href="#top" className="flex items-center gap-2.5 text-lg font-bold no-underline">
          <Image src="/landing/logo.webp" alt="" width={32} height={32} preload className="size-8" />
          {brand.name}
        </a>
        {/* Tighter links until xl, so the nav and both buttons fit a 1024px screen. */}
        <nav className="ml-auto hidden items-center gap-4 text-[0.95rem] text-[var(--on-dark-muted)] lg:flex xl:gap-6">
          {NAV.map((item) =>
            item.href.startsWith("/") ? (
              <Link key={item.href} href={item.href} className="nav-link font-medium">
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className="nav-link font-medium">
                {item.label}
              </a>
            ),
          )}
        </nav>
        {/* Phones get the one primary button; the hero has the demo. */}
        <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
          <TryDemo small className="!my-0 !mb-1.5 !hidden sm:!inline-flex" />
          <GetStarted small className="!my-0 !mb-1.5" />
        </div>
      </div>
    </header>
  );
}
