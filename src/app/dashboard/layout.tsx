import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(246,243,236,.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-[34px]">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="flex size-[34px] items-center justify-center rounded-[11px] bg-linear-to-br from-[var(--primary)] to-[var(--secondary)] text-sm font-extrabold text-primary-foreground shadow-[0_14px_28px_-18px_rgba(30,96,145,.9)]">
              E
            </span>
            <span className="min-w-0 leading-none">
              <span className="block text-[15px] font-bold leading-tight text-[var(--ink)] sm:text-[17px]">
                Energize Website Builder
              </span>
              <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)] sm:block">
                Internal site production
              </span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-[11px] border border-transparent px-3 py-2 text-sm font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--line)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] sm:inline-flex"
            >
              Dashboard
            </Link>
            <UserButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-[34px]">
        {children}
      </div>
    </div>
  );
}
