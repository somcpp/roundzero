"use client";

import { useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { AlertDialog, Button } from "@heroui/react";
import { useReadOnly } from "./read-only";

/**
 * A button for anything destructive: pressing it asks first, and only
 * `onConfirm` does the work. `onConfirm` may be async and return an error
 * message, which is shown in the dialog instead of closing it. Off in
 * read-only views (read-only.tsx).
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  children,
  ...trigger
}: Omit<ComponentProps<typeof Button>, "onPress" | "children"> & {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel?: ReactNode;
  onConfirm: () => void | string | undefined | Promise<void | string | undefined>;
  children: ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const readOnly = useReadOnly();

  const confirm = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await onConfirm();
      if (typeof result === "string") setError(result);
      else setOpen(false);
    });

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) setError(undefined);
      }}
    >
      <Button variant="danger-soft" size="sm" {...trigger} isDisabled={readOnly || pending || trigger.isDisabled}>
        {children}
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              {description && <p>{description}</p>}
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button variant="danger" isDisabled={pending} onPress={confirm}>
                {pending && pendingLabel ? pendingLabel : confirmLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/**
 * The same confirmation as ConfirmButton, opened from code instead of a
 * trigger — e.g. "discard unsaved changes?" when a drawer is closed, or an
 * action picked from a menu. `children` go under the description (a reason
 * field, say). `onConfirm` closes it by flipping `isOpen`; it may be async and
 * return an error message, which is shown in the dialog instead.
 */
export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  children,
}: {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void | string | undefined | Promise<void | string | undefined>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  pendingLabel?: ReactNode;
  cancelLabel?: ReactNode;
  children?: ReactNode;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const cancel = () => {
    setError(undefined);
    onCancel();
  };
  const confirm = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await onConfirm();
      if (typeof result === "string") setError(result);
    });

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && cancel()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          {(description || children || error) && (
            <AlertDialog.Body>
              {description && <p>{description}</p>}
              {children}
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </AlertDialog.Body>
          )}
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={cancel}>
              {cancelLabel}
            </Button>
            <Button variant="danger" isDisabled={pending} onPress={confirm}>
              {pending && pendingLabel ? pendingLabel : confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
