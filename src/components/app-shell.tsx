"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/builds", label: "Website Builds" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/templates", label: "Template Library" },
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
        <header className="topnav">
          <Link href="/dashboard" className="topnav-brand">
            <span className="brand-mark">E</span>
            <span className="brand-name">Energize Website Builder</span>
          </Link>
          <nav className="topnav-links" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname === "/dashboard/new"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  data-active={active}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="topnav-right">
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
          </div>
        </header>
        {children}
        <footer
          className="app-version"
          aria-label="Application version"
          data-app-version={version}
          data-build-id={buildId}
        >
          <span className="app-version-label">System release</span>
          <span className="app-version-value">
            Builder v{version} / Build {buildId}
          </span>
        </footer>
      </div>
    </div>
  );
}
