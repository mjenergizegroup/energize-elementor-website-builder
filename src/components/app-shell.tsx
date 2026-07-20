"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  FolderKanban,
  LayoutDashboard,
  PanelsTopLeft,
  UsersRound,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/builds", label: "Website Builds", icon: FolderKanban },
  { href: "/dashboard/clients", label: "Clients", icon: UsersRound },
  {
    href: "/dashboard/templates",
    label: "Template Library",
    icon: PanelsTopLeft,
  },
];

export function AppShell({
  children,
  version,
  buildId,
}: {
  children: React.ReactNode;
  version: string;
  buildId: string;
}) {
  const pathname = usePathname();

  return (
    <div className="app-wrap">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-main">
            <Link href="/dashboard" className="sidebar-brand">
              <Image
                src="/brand/energize-logo.png"
                alt="Energize Group"
                width={180}
                height={81}
                priority
                className="sidebar-logo"
              />
            </Link>

            <nav className="sidebar-nav" aria-label="Primary navigation">
              {navItems.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard" || pathname === "/dashboard/new"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-link"
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="nav-icon" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="sidebar-bottom">
            <div className="sidebar-account">
              <UserButton
                appearance={{
                  variables: {
                    fontFamily: "Inter, sans-serif",
                    colorPrimary: "var(--color-primary)",
                    colorText: "var(--color-text-primary)",
                    colorTextSecondary: "var(--color-text-secondary)",
                    colorBackground: "var(--color-surface-raised)",
                    borderRadius: "10px",
                  },
                  elements: {
                    userButtonAvatarBox: "energize-clerk-avatar",
                    userButtonPopoverCard: "energize-clerk-menu",
                    userButtonPopoverActionButton: "energize-clerk-menu-action",
                    userButtonPopoverFooter: "energize-clerk-menu-footer",
                  },
                }}
              />
              <span className="sidebar-account-label">Account</span>
            </div>
            <footer
              className="app-version"
              aria-label="Application version"
              data-app-version={version}
              data-build-id={buildId}
            >
              <span className="app-version-label">Version</span>
              <span className="app-version-value">
                {version} / {buildId}
              </span>
            </footer>
          </div>
        </aside>

        <div className="app-stage">{children}</div>
      </div>
    </div>
  );
}
