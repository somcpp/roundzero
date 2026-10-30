"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Dropdown, Header, Label, Separator } from "@heroui/react";
import { signOut } from "@/lib/auth";
import type { CurrentUser } from "@/lib/supabase/server";
import { PixelIcon } from "./pixel-icon";
import { Avatar, cn } from "./ui";

/** Signed-in admin menu: who you are, org settings, sign out. `compact` shows just the avatar. */
export function Account({ user, compact = false }: { user: CurrentUser | null; compact?: boolean }) {
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();
  const name = user?.name ?? user?.email ?? "Admin";

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Account menu"
        className={cn(
          "flex h-10 items-center rounded-lg text-[15px] font-medium transition hover:bg-surface-secondary data-[pressed]:bg-surface-secondary",
          compact ? "w-10 justify-center" : "gap-2.5 px-2",
        )}
      >
        <Avatar name={name} size={30} />
        {!compact && (
          <>
            <span className="hidden max-w-48 truncate lg:inline">{name}</span>
            <PixelIcon name="arrow-down" size={10} className="text-muted" />
          </>
        )}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-56">
        <Dropdown.Menu
          aria-label="Account"
          disabledKeys={signingOut ? ["signout"] : []}
          onAction={(key) => {
            if (key === "settings") router.push("/settings");
            if (key === "signout") startSignOut(() => signOut());
          }}
        >
          <Dropdown.Section>
            {/* Menu headers are pixel-font caps; who you are reads as plain text. */}
            <Header className="flex max-w-56 flex-col font-sans tracking-normal normal-case">
              <span className="truncate text-sm font-medium text-foreground">{name}</span>
              {user?.name && user.email && <span className="truncate text-xs text-muted">{user.email}</span>}
              {user?.demo && <span className="text-xs text-muted">Demo account · nothing is saved</span>}
            </Header>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section>
            <Dropdown.Item id="settings" textValue="Settings">
              <PixelIcon name="gear" size={12} />
              <Label>Settings</Label>
            </Dropdown.Item>
            <Dropdown.Item id="signout" textValue="Sign out">
              <PixelIcon name="arrow-right" size={12} />
              <Label>{signingOut ? "Signing out…" : "Sign out"}</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
