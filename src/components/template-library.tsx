"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Eye, FileJson, Plus, Search, Settings2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutThumbnail } from "@/components/layout-thumbnail";
import { LayoutPreviewDialog } from "@/components/layout-preview-dialog";
import {
  LAYOUT_CATEGORIES,
  type LayoutCategory,
  type LayoutLibraryItem,
} from "@/lib/layouts/types";
import {
  generatedLayoutNumber,
  inferLayoutCategory,
  layoutCategoryLabel as categoryLabel,
  layoutDisplayName,
} from "@/lib/layouts/naming";

type Filter = "all" | LayoutCategory;

interface PendingLayout {
  id: string;
  file: File;
  friendlyName: string;
  category: LayoutCategory;
  error?: string;
}

function nextFriendlyName(category: LayoutCategory, index: number) {
  return `${categoryLabel(category)} Layout ${index}`;
}

export function TemplateLibrary({ initialLayouts }: { initialLayouts: LayoutLibraryItem[] }) {
  const [layouts, setLayouts] = useState(initialLayouts);
  const [selectedId, setSelectedId] = useState(initialLayouts[0]?.id ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<PendingLayout[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewLayoutId, setPreviewLayoutId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleLayouts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return layouts.filter((layout) => {
      if (filter !== "all" && layout.category !== filter) return false;
      return !needle || layoutDisplayName(layout).toLowerCase().includes(needle);
    });
  }, [filter, layouts, query]);
  const selected = layouts.find((layout) => layout.id === selectedId) ?? visibleLayouts[0];
  const previewLayout = layouts.find((layout) => layout.id === previewLayoutId) ?? null;

  function openPreview(layout: LayoutLibraryItem) {
    setSelectedId(layout.id);
    setPreviewLayoutId(layout.id);
  }

  function chooseFiles(files: FileList | File[] | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const valid = incoming.filter(
      (file) =>
        file.name.toLowerCase().endsWith(".json") &&
        file.size > 0 &&
        file.size <= 2 * 1024 * 1024,
    );
    const rejected = incoming.length - valid.length;
    if (rejected > 0) {
      toast.error(
        `${rejected} file${rejected === 1 ? " was" : "s were"} skipped. Use JSON files smaller than 2 MB.`,
      );
    }
    if (valid.length > Math.max(0, 20 - pending.length)) {
      toast.warning("Only the first 20 layout files can be added at once.");
    }
    setPending((current) => {
      const existingFiles = new Set(
        current.map(
          (item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`,
        ),
      );
      const rows = [...current];
      const nextNumber = new Map<LayoutCategory, number>();
      for (const category of LAYOUT_CATEGORIES.map((item) => item.value)) {
        const numbers = [
          ...layouts
            .filter((layout) => layout.category === category)
            .map((layout) => generatedLayoutNumber(layout.friendlyName)),
          ...current
            .filter((item) => item.category === category)
            .map((item) => generatedLayoutNumber(item.friendlyName)),
        ].filter((value): value is number => typeof value === "number");
        nextNumber.set(category, Math.max(0, ...numbers) + 1);
      }
      for (const file of valid) {
        if (rows.length >= 20) break;
        const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
        if (existingFiles.has(fileKey)) continue;
        existingFiles.add(fileKey);
        const category = inferLayoutCategory(file.name);
        const number = nextNumber.get(category) ?? 1;
        nextNumber.set(category, number + 1);
        rows.push({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          friendlyName: nextFriendlyName(category, number),
          category,
        });
      }
      return rows;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updatePending(id: string, patch: Partial<PendingLayout>) {
    setPending((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch, error: undefined } : item)),
    );
  }

  function changePendingCategory(id: string, category: LayoutCategory) {
    setPending((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const number = generatedLayoutNumber(item.friendlyName);
        return {
          ...item,
          category,
          friendlyName:
            number === undefined
              ? item.friendlyName
              : nextFriendlyName(category, number),
          error: undefined,
        };
      }),
    );
  }

  async function prepareLayouts() {
    if (pending.length === 0 || uploading) return;
    if (pending.some((item) => item.friendlyName.trim().length < 2)) {
      toast.error("Add a friendly name for every layout.");
      return;
    }

    setUploading(true);
    const created: LayoutLibraryItem[] = [];
    const failed = new Map<string, string>();
    for (const item of pending) {
      const body = new FormData();
      body.set("file", item.file);
      body.set("friendlyName", item.friendlyName.trim());
      body.set("category", item.category);
      try {
        const response = await fetch("/api/layouts", { method: "POST", body });
        const json = (await response.json()) as { layout?: LayoutLibraryItem; error?: string };
        if (!response.ok || !json.layout) {
          failed.set(item.id, json.error ?? "This layout could not be prepared.");
          continue;
        }
        created.push(json.layout);
      } catch {
        failed.set(item.id, "The upload stopped before this layout could be saved.");
      }
    }

    if (created.length > 0) {
      setLayouts((current) => [...created, ...current]);
      setSelectedId(created[0].id);
      toast.success(
        created.length === 1
          ? `${created[0].friendlyName} was added.`
          : `${created.length} layouts were added.`,
      );
    }
    setPending((current) =>
      current
        .filter((item) => failed.has(item.id))
        .map((item) => ({ ...item, error: failed.get(item.id) })),
    );
    if (failed.size === 0) setAdding(false);
    else toast.error(`${failed.size} layout file${failed.size === 1 ? " needs" : "s need"} attention.`);
    setUploading(false);
  }

  return (
    <>
      <section className="page-banner">
        <div>
          <div className="eyebrow">Template Library</div>
          <h1 className="page-title">Template Library</h1>
          <p className="page-copy">Choose safe, reusable layouts for website builds.</p>
        </div>
        <Button size="lg" onClick={() => setAdding((value) => !value)} aria-expanded={adding}>
          {adding ? <X data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
          {adding ? "Close" : "Add layout"}
        </Button>
      </section>

      {adding && (
        <section className="mb-6 overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] p-5">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">Add safe layouts</h2>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Name each layout for the team. The source file is checked and cleaned before use.
              </p>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload data-icon="inline-start" /> Choose JSON files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              multiple
              className="sr-only"
              onChange={(event) => chooseFiles(event.target.files)}
            />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFiles(event.dataTransfer.files);
            }}
            data-dragging={dragging}
            className={`flex w-full flex-col items-center justify-center gap-3 border-b border-[var(--color-border-default)] p-6 text-center transition-colors ${
              pending.length === 0 ? "min-h-44" : "min-h-28"
            } ${
              dragging
                ? "bg-[var(--color-primary-tint)] outline-2 outline-inset outline-[var(--color-primary)]"
                : "bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface)]"
            }`}
          >
            <span className="flex size-12 items-center justify-center rounded-md bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
              <FileJson className="size-5" />
            </span>
            <span className="text-sm font-bold">
              {dragging
                ? "Drop JSON layouts to add them"
                : "Drag and drop Elementor JSON layouts here"}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Or click to choose files. Up to 20 files, 2 MB each.
            </span>
          </button>

          {pending.length > 0 && (
            <div>
              <div className="hidden grid-cols-[minmax(0,1fr)_220px_48px] gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] px-5 py-3 text-xs font-semibold text-[var(--color-text-faint)] md:grid">
                <span>Friendly layout name</span>
                <span>Category</span>
                <span />
              </div>
              {pending.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 border-b border-[var(--color-border-default)] p-5 md:grid-cols-[minmax(0,1fr)_220px_48px] md:items-start"
                >
                  <div>
                    <Input
                      value={item.friendlyName}
                      aria-label={`Friendly name for ${item.file.name}`}
                      onChange={(event) => updatePending(item.id, { friendlyName: event.target.value })}
                    />
                    <p className="mt-1.5 truncate text-[10px] text-[var(--color-text-secondary)]">
                      Source file: {item.file.name}
                    </p>
                    {item.error && <p className="mt-2 text-xs font-semibold text-[var(--color-danger)]">{item.error}</p>}
                  </div>
                  <Select
                    value={item.category}
                    onValueChange={(value) =>
                      changePendingCategory(item.id, value as LayoutCategory)
                    }
                  >
                    <SelectTrigger aria-label={`Category for ${item.friendlyName}`}>
                      <SelectValue>{categoryLabel(item.category)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LAYOUT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remove ${item.friendlyName}`}
                    onClick={() => setPending((current) => current.filter((row) => row.id !== item.id))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Plus data-icon="inline-start" /> Add more files
                </Button>
                <Button onClick={() => void prepareLayouts()} disabled={uploading}>
                  {uploading ? "Checking layouts" : `Prepare ${pending.length} layout${pending.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border-default)] p-3">
          {(["all", ...LAYOUT_CATEGORIES.map((item) => item.value)] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              data-active={filter === value}
              className="h-9 rounded-pill border border-transparent px-4 text-sm font-medium text-[var(--color-text-secondary)] data-[active=true]:border-[var(--color-primary)] data-[active=true]:bg-[var(--color-primary-tint)] data-[active=true]:font-semibold data-[active=true]:text-[var(--color-primary-hover)]"
            >
              {value === "all" ? "All" : categoryLabel(value)}
            </button>
          ))}
          <label className="relative ml-auto min-w-56 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search layouts"
              placeholder="Search layouts"
              className="pl-10"
            />
          </label>
        </div>

        {layouts.length === 0 ? (
          <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-md bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
              <FileJson className="size-5" />
            </span>
            <h2 className="text-xl font-semibold tracking-[-0.02em]">No layouts yet</h2>
            <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
              Add a JSON layout once, give it a friendly name, and reuse it across website builds.
            </p>
            <Button onClick={() => setAdding(true)}>
              <Plus data-icon="inline-start" /> Add layout
            </Button>
          </div>
        ) : (
          <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="border-b border-[var(--color-border-default)] p-5 lg:border-r lg:border-b-0">
              {visibleLayouts.length === 0 ? (
                <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No layouts match this filter.</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleLayouts.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => openPreview(layout)}
                      data-selected={selected?.id === layout.id}
                      className="group relative rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-3 text-left shadow-xs outline-none transition-[border-color,background-color,box-shadow] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] data-[selected=true]:border-[var(--color-primary)] data-[selected=true]:ring-2 data-[selected=true]:ring-[rgb(57_115_210_/_10%)]"
                      aria-label={`Preview ${layoutDisplayName(layout)}`}
                    >
                      <LayoutThumbnail data={layout.thumbnail} className="aspect-[1.28/1]" />
                      <span className="absolute top-5 right-5 flex items-center gap-1.5 rounded-pill bg-[var(--color-surface-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary-hover)] shadow-sm">
                        <Eye className="size-3" /> Preview
                      </span>
                      <h3 className="mt-3 truncate text-base font-semibold tracking-[-0.01em]">
                        {layoutDisplayName(layout)}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-[var(--color-text-faint)]">
                        {categoryLabel(layout.category)}
                      </p>
                      <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border-default)] pt-3 text-xs font-semibold">
                        {layout.status === "ready" ? (
                          <>
                            <Check className="size-4 text-[var(--color-success)]" /> Ready
                          </>
                        ) : (
                          <>
                            <Settings2 className="size-4 text-[var(--color-warning)]" /> Needs setup
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <aside className="flex flex-col bg-[var(--color-surface)]">
                <div className="flex-1 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-faint)]">
                    {categoryLabel(selected.category)} layout
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                    {layoutDisplayName(selected)}
                  </h2>
                  <LayoutThumbnail data={selected.thumbnail} className="mt-5 aspect-[1.28/1]" />
                  <p className="mt-4 border-b border-[var(--color-border-default)] pb-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {selected.structuralSummary}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                    {selected.status === "ready" ? (
                      <>
                        <Check className="size-5 text-[var(--color-success)]" /> Ready to use
                      </>
                    ) : (
                      <>
                        <Settings2 className="size-5 text-[var(--color-warning)]" /> Needs template setup
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    onClick={() => openPreview(selected)}
                  >
                    <Eye data-icon="inline-start" /> Preview layout
                  </Button>
                  {selected.status === "ready" ? (
                    <Link
                      href="/dashboard/new?type=migrate"
                      className={buttonVariants({ className: "mt-2 w-full" })}
                    >
                      Start website build
                    </Link>
                  ) : (
                    <Button className="mt-5 w-full" disabled>
                      Not available yet
                    </Button>
                  )}
                </div>
                <Link
                  href={`/dashboard/templates/${selected.id}`}
                  className="flex items-center gap-2 border-t border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5 text-sm font-semibold text-[var(--color-primary-hover)] hover:bg-[var(--color-primary-tint)]"
                >
                  <Settings2 className="size-4" /> Manage template setup
                </Link>
              </aside>
            )}
          </div>
        )}
      </section>
      <LayoutPreviewDialog
        layout={previewLayout}
        open={Boolean(previewLayout)}
        onOpenChange={(open) => {
          if (!open) setPreviewLayoutId(null);
        }}
      />
    </>
  );
}
