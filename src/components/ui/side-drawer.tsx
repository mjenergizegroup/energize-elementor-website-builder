"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SideDrawer({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  children,
  footer,
  size = "default",
  preventClose = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "default" | "wide";
  preventClose?: boolean;
}) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && preventClose) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="side-drawer-backdrop" />
        <Dialog.Viewport className="side-drawer-viewport">
          <Dialog.Popup
            className={cn(
              "side-drawer-panel",
              size === "wide" && "side-drawer-panel-wide",
            )}
          >
            <header className="side-drawer-head">
              <div className="min-w-0 flex-1">
                {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
                <Dialog.Title className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[var(--color-text-primary)]">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none transition-colors hover:bg-[var(--color-primary-tint)] hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Close ${title}`}
                disabled={preventClose}
              >
                <X className="size-4" />
              </Dialog.Close>
            </header>

            <div className="side-drawer-body">{children}</div>

            {footer ? <footer className="side-drawer-footer">{footer}</footer> : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
