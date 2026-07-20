"use client";

import Link, { useLinkStatus } from "next/link";

function BuildTypeLinkContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span className="min-w-0">
        <span className="block text-base font-semibold tracking-[-0.015em] text-[var(--color-text-primary)]">
          {title}
        </span>
        <span className="mt-2 block text-xs leading-5 text-[var(--color-text-secondary)]">
          {description}
        </span>
      </span>
      <span
        className="text-xs font-semibold text-[var(--color-text-faint)] transition-colors duration-200 group-hover:text-[var(--color-primary-hover)]"
        aria-live="polite"
      >
        {pending ? "Opening" : "Open"}
      </span>
      {pending ? <span className="build-type-link-progress" aria-hidden="true" /> : null}
    </>
  );
}

export function BuildTypeLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 overflow-hidden rounded-lg bg-[var(--color-surface-raised)] p-5 shadow-xs outline-none transition-[background-color,box-shadow] duration-200 ease-out hover:bg-[var(--color-row-hover)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:bg-[var(--color-primary-tint)]"
    >
      <BuildTypeLinkContent title={title} description={description} />
    </Link>
  );
}
