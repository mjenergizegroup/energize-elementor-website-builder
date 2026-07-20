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
      <div className="flex min-h-28 items-center justify-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface)] sm:min-h-36">
        <div className="flex size-12 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)]">
          <ImageIcon className="size-5" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (kind === "heading") {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-2 w-14 bg-[var(--color-primary)]" />
        <div className="h-4 w-4/5 rounded-sm bg-[var(--color-text-primary)]" />
        <div className="h-4 w-3/5 rounded-sm bg-[var(--color-text-primary)]" />
      </div>
    );
  }
  if (kind === "body") {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-2 w-full rounded-sm bg-[var(--color-border-strong)]" />
        <div className="h-2 w-11/12 rounded-sm bg-[var(--color-border-default)]" />
        <div className="h-2 w-4/5 rounded-sm bg-[var(--color-surface)]" />
      </div>
    );
  }
  return <div className="h-8 w-24 rounded-md bg-[var(--color-primary)]" aria-hidden="true" />;
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
      className="mx-auto w-full max-w-[780px] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)]"
      role="img"
      aria-label={`Content-free visual preview of ${name}`}
    >
      <div className="flex h-12 items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] px-4">
        <span className="size-6 rounded-sm bg-[var(--color-primary)]" />
        <span className="h-2.5 w-28 rounded-sm bg-[var(--color-text-primary)]" />
        <span className="ml-auto hidden h-2 w-12 rounded-sm bg-[var(--color-text-faint)] sm:block" />
        <span className="hidden h-2 w-12 rounded-sm bg-[var(--color-text-faint)] sm:block" />
        <span className="hidden h-2 w-12 rounded-sm bg-[var(--color-text-faint)] sm:block" />
        <span className="h-7 w-20 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]" />
      </div>

      {preview.sections.map((section, sectionIndex) => {
        const regions = section.regions.length > 0 ? section.regions : [{ slots: [] }];
        return (
          <section
            key={sectionIndex}
            className={`border-b border-[var(--color-border-default)] last:border-b-0 ${
              sectionIndex % 2 === 0 ? "bg-[var(--color-surface-raised)]" : "bg-[var(--color-surface)]"
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
                    <div className="min-h-16 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]" />
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="grid grid-cols-[1fr_auto] gap-6 border-t border-[var(--color-border-default)] bg-[var(--color-surface)] px-5 py-6">
        <div className="space-y-2">
          <div className="h-2.5 w-32 bg-[var(--color-surface-raised)]" />
          <div className="h-1.5 w-48 max-w-full rounded-sm bg-[var(--color-text-faint)]" />
        </div>
        <div className="flex gap-4">
          <span className="h-2 w-10 rounded-sm bg-[var(--color-text-faint)]" />
          <span className="h-2 w-10 rounded-sm bg-[var(--color-text-faint)]" />
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
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-[rgb(26_29_33_/_42%)]" />
        <Dialog.Viewport className="fixed inset-0 z-[71] flex items-center justify-center p-4 sm:p-6">
          <Dialog.Popup className="flex max-h-[calc(100dvh-32px)] w-full max-w-6xl flex-col rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-md outline-none sm:max-h-[calc(100dvh-48px)]">
            <header className="flex items-start gap-5 border-b border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-5 py-4 text-[var(--color-text-primary)]">
              <Eye className="mt-1 size-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-faint)]">
                  {layoutCategoryLabel(layout.category)} layout preview
                </p>
                <Dialog.Title className="mt-1 truncate text-xl font-semibold tracking-[-0.02em]">
                  {layout.friendlyName}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  Placeholder content shows the reusable structure without source-site text or images.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                aria-label="Close layout preview"
              >
                <X className="size-4" />
              </Dialog.Close>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-h-0 overflow-y-auto bg-[var(--color-canvas)] p-5 sm:p-8">
                {preview ? <LayoutPreviewCanvas name={layout.friendlyName} preview={preview} /> : null}
              </div>
              <aside className="border-t border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 lg:border-t-0 lg:border-l">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {layout.status === "ready" ? (
                    <>
                      <Check className="size-5 text-[var(--color-success)]" /> Ready to use
                    </>
                  ) : (
                    <>
                      <Settings2 className="size-5 text-[var(--color-warning)]" /> Needs setup
                    </>
                  )}
                </div>
                <p className="mt-5 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {layout.structuralSummary}
                </p>
                <dl className="mt-5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-xs">
                  {[
                    ["Sections", layout.thumbnail.sectionCount],
                    ["Headings", layout.thumbnail.headingSlots],
                    ["Text areas", layout.thumbnail.bodySlots],
                    ["Images", layout.thumbnail.imageSlots],
                    ["Buttons", layout.thumbnail.buttonSlots],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] px-3 py-2.5 last:border-b-0"
                    >
                      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                      <dd className="font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 min-h-5 text-[10px] font-semibold text-[var(--color-text-secondary)]" aria-live="polite">
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
