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
      className={`overflow-hidden border border-[var(--color-hairline)] bg-white ${className}`}
      aria-label={`Structural preview with ${data.sectionCount} sections`}
    >
      <div className="grid min-h-28 grid-cols-[1.05fr_0.95fr] border-b border-[var(--color-hairline)]">
        <div className="space-y-2 p-4">
          <div className="h-2 w-10 bg-[#5b5b5b]" />
          <div className="h-2.5 w-3/4 bg-[#292929]" />
          <div className="h-1.5 w-full bg-[#c9c9c9]" />
          <div className="h-1.5 w-4/5 bg-[#d6d6d6]" />
          {data.buttonSlots > 0 && <div className="mt-3 h-3 w-14 bg-[#4b4b4b]" />}
        </div>
        <div className="flex items-center justify-center bg-[#e1e1e1]">
          <div className="size-10 rotate-45 bg-[#b5b5b5]" />
        </div>
      </div>
      <div className="grid grid-cols-3 border-b border-[var(--color-hairline)]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-1.5 border-r border-[var(--color-hairline)] p-3 last:border-r-0">
            <div className="size-2 bg-[#8e8e8e]" />
            <div className="h-1.5 w-3/4 bg-[#b9b9b9]" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${trustItems > 2 ? 2 : 1}, minmax(0, 1fr))` }}>
        {Array.from({ length: contentRows }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <div className="h-2 w-1/2 bg-[#5b5b5b]" />
            <div className="h-1.5 w-full bg-[#c6c6c6]" />
            <div className="h-1.5 w-4/5 bg-[#d3d3d3]" />
          </div>
        ))}
      </div>
    </div>
  );
}
