import Link from "next/link";
import { brand } from "@/lib/branding";
import { getCurrentUser } from "@/lib/supabase/server";
import { Account } from "./account";
import { BrandMark } from "./brand-mark";
import { PixelIcon } from "./pixel-icon";

export async function AppBar() {
  const user = await getCurrentUser();
  // The demo account reads the docs in a new tab, so the demo stays open.
  const newTab = user?.demo ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <header className="border-b-2 border-border bg-background/90">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="size-10" badgeClassName="lip bg-accent text-sm text-accent-foreground" />
          <span className="font-pixel text-xl font-bold">{brand.name}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/docs"
            {...newTab}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-semibold text-muted transition hover:bg-surface-secondary hover:text-foreground"
          >
            Docs
            {user?.demo && <PixelIcon name="external" size={10} />}
          </Link>
          <Account user={user} />
        </div>
      </div>
    </header>
  );
}
