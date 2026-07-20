"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { SideDrawer } from "@/components/ui/side-drawer";

export function RouteSideDrawer({
  closeHref,
  backHref,
  backLabel = "Build types",
  children,
  ...props
}: {
  closeHref: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: "default" | "wide" | "workspace";
  tone?: "default" | "soft";
  bodyClassName?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function closeDrawer() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(false);
    closeTimer.current = setTimeout(
      () => router.push(closeHref),
      reduceMotion ? 0 : 270,
    );
  }

  return (
    <SideDrawer
      {...props}
      open={open}
      entrance="route"
      leadingAction={
        backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        ) : undefined
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeDrawer();
      }}
    >
      {children}
    </SideDrawer>
  );
}
