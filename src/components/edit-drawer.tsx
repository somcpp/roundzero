"use client";

import type { ReactNode } from "react";
import { Drawer } from "@heroui/react";
import { cn } from "./ui";

/**
 * Right-hand drawer for editing one item from a list. Controlled: the list owns
 * which item is open. The backdrop is transparent so the selected card stays
 * visible behind it.
 */
export function EditDrawer({
  isOpen,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  wide,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Room for wider content, like an email preview. */
  wide?: boolean;
}) {
  return (
    <Drawer isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Backdrop variant="transparent">
        <Drawer.Content placement="right">
          <Drawer.Dialog className={cn("flex h-full w-full flex-col", wide ? "sm:w-xl sm:max-w-xl" : "sm:w-md sm:max-w-md")}>
            <Drawer.CloseTrigger />
            <Drawer.Header className="flex flex-col items-start gap-1.5">
              {eyebrow && <span className="font-pixel text-xs uppercase tracking-wide text-muted">{eyebrow}</span>}
              <Drawer.Heading className="text-xl leading-tight">{title}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-5 text-foreground">{children}</Drawer.Body>
            {footer && <Drawer.Footer>{footer}</Drawer.Footer>}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
