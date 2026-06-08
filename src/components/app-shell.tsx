"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/builds", label: "Builds" },
  { href: "/dashboard/clients", label: "Clients" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-wrap">
      <div className="app-shell">
        <header className="topnav">
          <Link href="/dashboard" className="topnav-brand">
            <span className="brand-mark">E</span>
            <span>
              <span className="brand-name">Energize Builder</span>
              <span className="brand-ver">Production</span>
            </span>
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
            <UserButton />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
