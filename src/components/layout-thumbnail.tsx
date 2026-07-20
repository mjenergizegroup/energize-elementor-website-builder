import type { LayoutThumbnail as LayoutThumbnailData } from "@/lib/layouts/types";

export function LayoutThumbnail({
  data,
  className = "",
}: {
  data: LayoutThumbnailData;
  className?: string;
}) {
  const contentRows = Math.max(1, Math.min(3, data.bodySlots));
  const trustItems = Math.max(2, Math.min(4, data.sectionCount));

  return (
    <div
      className={`overflow-hidden rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] ${className}`}
      aria-label={`Structural preview with ${data.sectionCount} sections`}
    >
      <div className="grid min-h-28 grid-cols-[1.05fr_0.95fr] border-b border-[var(--color-border-default)]">
        <div className="space-y-2 p-4">
          <div className="h-2 w-10 rounded-sm bg-[var(--color-primary)]" />
          <div className="h-2.5 w-3/4 rounded-sm bg-[var(--color-text-primary)]" />
          <div className="h-1.5 w-full rounded-sm bg-[var(--color-border-strong)]" />
          <div className="h-1.5 w-4/5 rounded-sm bg-[var(--color-border-default)]" />
          {data.buttonSlots > 0 && <div className="mt-3 h-3 w-14 rounded-sm bg-[var(--color-primary)]" />}
        </div>
        <div className="flex items-center justify-center bg-[var(--color-primary-tint)]">
          <div className="size-10 rotate-45 rounded-sm bg-[var(--color-border-strong)]" />
        </div>
      </div>
      <div className="grid grid-cols-3 border-b border-[var(--color-border-default)]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-1.5 border-r border-[var(--color-border-default)] p-3 last:border-r-0">
            <div className="size-2 rounded-sm bg-[var(--color-text-faint)]" />
            <div className="h-1.5 w-3/4 rounded-sm bg-[var(--color-border-strong)]" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${trustItems > 2 ? 2 : 1}, minmax(0, 1fr))` }}>
        {Array.from({ length: contentRows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <div className="h-2 w-1/2 rounded-sm bg-[var(--color-text-secondary)]" />
            <div className="h-1.5 w-full rounded-sm bg-[var(--color-border-strong)]" />
            <div className="h-1.5 w-4/5 rounded-sm bg-[var(--color-border-default)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
