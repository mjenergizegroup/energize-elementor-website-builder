"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Check,
  Eye,
  Image as ImageIcon,
  LoaderCircle,
  Settings2,
  X,
} from "lucide-react";
import { layoutCategoryLabel } from "@/lib/layouts/naming";
import {
  previewFromThumbnail,
} from "@/lib/layouts/preview";
import type {
  LayoutLibraryItem,
  LayoutPreviewDocument,
  LayoutPreviewSlotKind,
} from "@/lib/layouts/types";

const previewCache = new Map<string, Promise<LayoutPreviewDocument>>();

function loadLayoutPreview(layoutId: string): Promise<LayoutPreviewDocument> {
  const cached = previewCache.get(layoutId);
  if (cached) return cached;
  const request = fetch(`/api/layouts/${layoutId}/preview`, {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      const result = (await response.json()) as {
        preview?: LayoutPreviewDocument;
        error?: string;
      };
      if (!response.ok || !result.preview) {
        throw new Error(result.error ?? "The preview could not be loaded.");
      }
      return result.preview;
    })
    .catch((error) => {
      previewCache.delete(layoutId);
      throw error;
    });
  previewCache.set(layoutId, request);
  return request;
}

function PreviewSlot({ kind }: { kind: LayoutPreviewSlotKind }) {
  if (kind === "image") {
    return (
      <div className="flex min-h-28 items-center justify-center border border-[#cbc8c1] bg-[#e7e5df] sm:min-h-36">
        <div className="flex size-12 items-center justify-center border border-[#9d9a94] bg-[#d2d0ca] text-[#6d6a65]">
          <ImageIcon className="size-5" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (kind === "heading") {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-2 w-14 bg-[var(--color-red)]" />
        <div className="h-4 w-4/5 bg-[#252525]" />
        <div className="h-4 w-3/5 bg-[#252525]" />
      </div>
    );
  }
  if (kind === "body") {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-2 w-full bg-[#c5c2bc]" />
        <div className="h-2 w-11/12 bg-[#cfccc6]" />
        <div className="h-2 w-4/5 bg-[#d9d6d0]" />
      </div>
    );
  }
  return <div className="h-8 w-24 border border-[#252525] bg-[var(--color-red)]" aria-hidden="true" />;
}

function LayoutPreviewCanvas({
  name,
  preview,
}: {
  name: string;
  preview: LayoutPreviewDocument;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[780px] border-2 border-[var(--color-black)] bg-white"
      role="img"
      aria-label={`Content-free visual preview of ${name}`}
    >
      <div className="flex h-12 items-center gap-3 border-b-2 border-[var(--color-black)] bg-[#f7f6f2] px-4">
        <span className="size-6 bg-[var(--color-red)]" />
        <span className="h-2.5 w-28 bg-[#292929]" />
        <span className="ml-auto hidden h-2 w-12 bg-[#a5a29c] sm:block" />
        <span className="hidden h-2 w-12 bg-[#a5a29c] sm:block" />
        <span className="hidden h-2 w-12 bg-[#a5a29c] sm:block" />
        <span className="h-7 w-20 border border-[#292929] bg-white" />
      </div>

      {preview.sections.map((section, sectionIndex) => {
        const regions = section.regions.length > 0 ? section.regions : [{ slots: [] }];
        return (
          <section
            key={sectionIndex}
            className={`border-b border-[#cbc8c1] last:border-b-0 ${
              sectionIndex % 2 === 0 ? "bg-white" : "bg-[#f7f6f2]"
            } ${sectionIndex === 0 ? "px-7 py-10" : "px-7 py-8"}`}
          >
            <div
              className="grid gap-7"
              style={{
                gridTemplateColumns: `repeat(${Math.min(4, regions.length)}, minmax(0, 1fr))`,
              }}
            >
              {regions.map((region, regionIndex) => (
                <div key={regionIndex} className="flex min-w-0 flex-col justify-center gap-5">
                  {region.slots.length > 0 ? (
                    region.slots.slice(0, 8).map((kind, slotIndex) => (
                      <PreviewSlot key={`${kind}-${slotIndex}`} kind={kind} />
                    ))
                  ) : (
                    <div className="min-h-16 border border-dashed border-[#b7b4ae] bg-[#efede8]" />
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="grid grid-cols-[1fr_auto] gap-6 bg-[var(--color-black)] px-5 py-6">
        <div className="space-y-2">
          <div className="h-2.5 w-32 bg-white" />
          <div className="h-1.5 w-48 max-w-full bg-[#777]" />
        </div>
        <div className="flex gap-4">
          <span className="h-2 w-10 bg-[#777]" />
          <span className="h-2 w-10 bg-[#777]" />
        </div>
      </div>
    </div>
  );
}

export function LayoutPreviewDialog({
  layout,
  open,
  onOpenChange,
}: {
  layout: LayoutLibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [preview, setPreview] = useState<LayoutPreviewDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !layout) return;
    let active = true;
    setPreview(previewFromThumbnail(layout.thumbnail));
    setLoading(true);
    setError("");
    void loadLayoutPreview(layout.id)
      .then((next) => {
        if (active) setPreview(next);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "The detailed preview could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [layout, open]);

  if (!layout) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-[rgba(25,25,25,0.78)]" />
        <Dialog.Viewport className="fixed inset-0 z-[71] flex items-center justify-center p-4 sm:p-6">
          <Dialog.Popup className="flex max-h-[calc(100dvh-32px)] w-full max-w-6xl flex-col border-2 border-[var(--color-black)] bg-[var(--color-surface)] outline-none sm:max-h-[calc(100dvh-48px)]">
            <header className="flex items-start gap-5 border-b-2 border-[var(--color-black)] bg-[var(--color-black)] px-5 py-4 text-white">
              <Eye className="mt-1 size-5 shrink-0 text-[var(--color-red)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a5a5a5]">
                  {layoutCategoryLabel(layout.category)} layout preview
                </p>
                <Dialog.Title className="mt-1 truncate text-xl font-black tracking-[-0.03em]">
                  {layout.friendlyName}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-[#b8b8b8]">
                  Placeholder content shows the reusable structure without source-site text or images.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="flex size-9 shrink-0 items-center justify-center border border-[#555] text-[#b8b8b8] outline-none transition-colors hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)]"
                aria-label="Close layout preview"
              >
                <X className="size-4" />
              </Dialog.Close>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-h-0 overflow-y-auto bg-[var(--color-canvas)] p-5 sm:p-8">
                {preview ? <LayoutPreviewCanvas name={layout.friendlyName} preview={preview} /> : null}
              </div>
              <aside className="border-t-2 border-[var(--color-black)] bg-[var(--color-panel)] p-5 lg:border-t-0 lg:border-l-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {layout.status === "ready" ? (
                    <>
                      <Check className="size-5 text-green-700" /> Ready to use
                    </>
                  ) : (
                    <>
                      <Settings2 className="size-5 text-[var(--color-red)]" /> Needs setup
                    </>
                  )}
                </div>
                <p className="mt-5 text-xs leading-5 text-[var(--color-muted)]">
                  {layout.structuralSummary}
                </p>
                <dl className="mt-5 border-2 border-[var(--color-black)] bg-white text-xs">
                  {[
                    ["Sections", layout.thumbnail.sectionCount],
                    ["Headings", layout.thumbnail.headingSlots],
                    ["Text areas", layout.thumbnail.bodySlots],
                    ["Images", layout.thumbnail.imageSlots],
                    ["Buttons", layout.thumbnail.buttonSlots],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-3 py-2.5 last:border-b-0"
                    >
                      <dt className="text-[var(--color-muted)]">{label}</dt>
                      <dd className="font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 min-h-5 text-[10px] font-semibold text-[var(--color-muted)]" aria-live="polite">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" /> Loading exact structure
                    </span>
                  ) : error ? (
                    "Showing the saved summary preview."
                  ) : (
                    "Exact sanitized structure loaded."
                  )}
                </div>
              </aside>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
