"use client";

import { useRouter } from "next/navigation";
import { SideDrawer } from "@/components/ui/side-drawer";

export function RouteSideDrawer({
  closeHref,
  children,
  ...props
}: {
  closeHref: string;
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: "default" | "wide";
}) {
  const router = useRouter();

  return (
    <SideDrawer
      {...props}
      open
      onOpenChange={(open) => {
        if (!open) router.push(closeHref);
      }}
    >
      {children}
    </SideDrawer>
  );
}
