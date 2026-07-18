"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Eye, LayoutTemplate, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LayoutPreviewDialog } from "@/components/layout-preview-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LayoutLibraryItem } from "@/lib/layouts/types";
import { layoutCategoryLabel } from "@/lib/layouts/naming";
import {
  normalizePageSlug,
  pagePath,
  suggestedTitleTag,
  validatePagePlan,
  type PagePlanItemInput,
  type PagePlanPageType,
} from "@/lib/page-plan/types";

const PAGE_SUGGESTIONS = [
  { name: "Home", type: "home" },
  { name: "About Us", type: "standard" },
  { name: "Contact Us", type: "contact" },
  { name: "Patient Resources", type: "standard" },
  { name: "Membership", type: "standard" },
  { name: "Amenities", type: "standard" },
] as const;

function preferredCategory(type: PagePlanPageType, name: string) {
  if (type === "home") return "home";
  if (type === "service") return "service";
  if (type === "contact") return "contact";
  if (/about/i.test(name)) return "about";
  return "flexible";
}

function selectDefaultLayout(
  layouts: LayoutLibraryItem[],
  type: PagePlanPageType,
  name: string,
) {
  const preferred = preferredCategory(type, name);
  return (
    layouts.find((layout) => layout.category === preferred)?.activeRevisionId ??
    layouts[0]?.activeRevisionId ??
    ""
  );
}

function uniqueSlug(items: PagePlanItemInput[], requested: string) {
  const base = normalizePageSlug(requested) || "page";
  const used = new Set(items.map((item) => normalizePageSlug(item.slug)));
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

function newItem(input: {
  items: PagePlanItemInput[];
  layouts: LayoutLibraryItem[];
  practiceName: string;
  pageName: string;
  pageType: PagePlanPageType;
  layoutRevisionId?: string;
}): PagePlanItemInput {
  const home = input.pageType === "home";
  return {
    id: crypto.randomUUID(),
    position: input.items.length,
    pageName: input.pageName.trim(),
    slug: home ? "" : uniqueSlug(input.items, input.pageName),
    titleTag: suggestedTitleTag(input.pageName, input.practiceName),
    pageType: input.pageType,
    layoutRevisionId:
      input.layoutRevisionId ??
      selectDefaultLayout(input.layouts, input.pageType, input.pageName),
    emptyDraftAllowed: true,
    status: "planned",
  };
}

export function PagePlanWorkspace({
  items,
  layouts,
  practiceName,
  saveState,
  onChange,
}: {
  items: PagePlanItemInput[];
  layouts: LayoutLibraryItem[];
  practiceName: string;
  saveState: "idle" | "saving" | "saved" | "error";
  onChange: (items: PagePlanItemInput[]) => void;
}) {
  const [mode, setMode] = useState<"page" | "services" | null>(null);
  const [pageName, setPageName] = useState("");
  const [pageType, setPageType] = useState<PagePlanPageType>("standard");
  const [pageLayout, setPageLayout] = useState("");
  const [serviceNames, setServiceNames] = useState("");
  const [serviceLayout, setServiceLayout] = useState(
    layouts.find((layout) => layout.category === "service")?.activeRevisionId ??
      layouts[0]?.activeRevisionId ??
      "",
  );
  const [previewLayoutId, setPreviewLayoutId] = useState<string | null>(null);
  const validation = useMemo(() => validatePagePlan(items, layouts), [items, layouts]);
  const layoutByRevision = useMemo(
    () => new Map(layouts.map((layout) => [layout.activeRevisionId, layout])),
    [layouts],
  );
  const missingSuggestions = PAGE_SUGGESTIONS.filter(
    (suggestion) => !items.some((item) => item.pageName.toLowerCase() === suggestion.name.toLowerCase()),
  );
  const previewLayout = layouts.find((layout) => layout.id === previewLayoutId) ?? null;

  function setItems(next: PagePlanItemInput[]) {
    onChange(next.map((item, position) => ({ ...item, position })));
  }

  function addPage() {
    const name = pageName.trim();
    if (!name) return;
    const item = newItem({
      items,
      layouts,
      practiceName,
      pageName: name,
      pageType,
      layoutRevisionId: pageLayout || undefined,
    });
    setItems([...items, item]);
    setPageName("");
    setPageType("standard");
    setPageLayout("");
    setMode(null);
  }

  function addSuggestedPage(name: string, type: PagePlanPageType) {
    setItems([
      ...items,
      newItem({ items, layouts, practiceName, pageName: name, pageType: type }),
    ]);
  }

  function addServices() {
    const names = serviceNames
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    if (names.length === 0 || !serviceLayout) return;
    const next = [...items];
    for (const name of names) {
      if (next.some((item) => item.pageName.toLowerCase() === name.toLowerCase())) continue;
      next.push(
        newItem({
          items: next,
          layouts,
          practiceName,
          pageName: name,
          pageType: "service",
          layoutRevisionId: serviceLayout,
        }),
      );
    }
    setItems(next);
    setServiceNames("");
    setMode(null);
  }

  function update(id: string, patch: Partial<PagePlanItemInput>) {
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  function duplicate(index: number) {
    const source = items[index];
    const pageName = `${source.pageName} Copy`;
    const copy: PagePlanItemInput = {
      ...source,
      id: crypto.randomUUID(),
      pageName,
      slug: uniqueSlug(items, `${source.slug || "home"}-copy`),
      titleTag: suggestedTitleTag(pageName, practiceName),
      status: "planned",
    };
    const next = [...items];
    next.splice(index + 1, 0, copy);
    setItems(next);
  }

  function remove(index: number) {
    const item = items[index];
    if (!window.confirm(`Remove ${item.pageName} from this Page Plan?`)) return;
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-[-0.03em]">Plan the destination pages</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--color-muted)]">
            Name every draft, choose its URL and title tag, then reuse any Ready layout as many times as needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMode(mode === "page" ? null : "page")}>
            <Plus data-icon="inline-start" /> Add page
          </Button>
          <Button onClick={() => setMode(mode === "services" ? null : "services")}>
            <Plus data-icon="inline-start" /> Add services
          </Button>
        </div>
      </div>

      {layouts.length === 0 && (
        <div className="border-2 border-[var(--color-red)] bg-[var(--color-red-light)] p-5">
          <p className="font-bold text-[var(--color-red)]">Add a Ready layout before planning pages.</p>
          <Link
            href="/dashboard/templates"
            className="mt-3 inline-flex text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-red)] underline underline-offset-4"
          >
            Open Template Library
          </Link>
        </div>
      )}

      {mode === "page" && (
        <section className="border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-base font-black tracking-[-0.02em]">Add one page</h4>
            <Button variant="ghost" size="icon-sm" onClick={() => setMode(null)} aria-label="Close add page form">
              <X />
            </Button>
          </div>
          {missingSuggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested pages">
              {missingSuggestions.map((suggestion) => (
                <button
                  key={suggestion.name}
                  type="button"
                  onClick={() => addSuggestedPage(suggestion.name, suggestion.type)}
                  disabled={layouts.length === 0}
                  className="border-2 border-[var(--color-black)] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] hover:bg-[var(--color-red-light)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + {suggestion.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.1em]">
              Page name
              <Input
                value={pageName}
                onChange={(event) => setPageName(event.target.value)}
                placeholder="Emergency Dentistry"
                className="normal-case tracking-normal"
              />
            </label>
            <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.1em]">
              Page type
              <Select value={pageType} onValueChange={(value) => setPageType(value as PagePlanPageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard page</SelectItem>
                  <SelectItem value="home">Home page</SelectItem>
                  <SelectItem value="service">Service page</SelectItem>
                  <SelectItem value="contact">Contact page</SelectItem>
                  <SelectItem value="custom">Custom page</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <LayoutSelect
              value={pageLayout || selectDefaultLayout(layouts, pageType, pageName)}
              layouts={layouts}
              onChange={setPageLayout}
              onPreview={setPreviewLayoutId}
              label="Layout"
            />
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={addPage} disabled={!pageName.trim() || layouts.length === 0}>Add page</Button>
          </div>
        </section>
      )}

      {mode === "services" && (
        <section className="border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-black tracking-[-0.02em]">Add service pages</h4>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Enter one service per line and apply one shared layout.</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setMode(null)} aria-label="Close add services form">
              <X />
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.1em]">
              Service page names
              <Textarea
                value={serviceNames}
                onChange={(event) => setServiceNames(event.target.value)}
                placeholder={"Emergency Dentistry\nPreventive Dentistry\nDental Implants\nTeeth Whitening"}
                className="min-h-40 normal-case tracking-normal"
              />
            </label>
            <LayoutSelect
              value={serviceLayout}
              layouts={layouts}
              onChange={setServiceLayout}
              onPreview={setPreviewLayoutId}
              label="Layout for these pages"
            />
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={addServices} disabled={!serviceNames.trim() || !serviceLayout}>
              Add service pages
            </Button>
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center border-2 border-dashed border-[var(--color-black)] p-8 text-center">
          <LayoutTemplate className="size-8 text-[var(--color-red)]" />
          <h4 className="mt-4 text-lg font-black tracking-[-0.03em]">No pages planned yet</h4>
          <p className="mt-2 max-w-sm text-sm text-[var(--color-muted)]">
            Add pages one at a time or add a list of services using one shared layout.
          </p>
        </div>
      ) : (
        <div className="border-2 border-[var(--color-black)]">
          <div className="hidden grid-cols-[minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(180px,1fr)_minmax(180px,0.8fr)_132px] gap-3 bg-[var(--color-black)] px-4 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-white lg:grid">
            <span>Page name</span><span>URL</span><span>Title tag</span><span>Layout</span><span />
          </div>
          {items.map((item, index) => {
            const errors = validation.errors[item.id] ?? [];
            const layout = layoutByRevision.get(item.layoutRevisionId);
            return (
              <div key={item.id} className="border-b border-[var(--color-hairline)] bg-white p-4 last:border-b-0">
                <div className="grid gap-3 lg:grid-cols-[minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(180px,1fr)_minmax(180px,0.8fr)_132px] lg:items-start">
                  <label className="space-y-1 text-[9px] font-bold uppercase tracking-[0.1em] lg:space-y-0 lg:text-[0px]">
                    Page name
                    <Input
                      value={item.pageName}
                      onChange={(event) => update(item.id, { pageName: event.target.value })}
                      aria-label={`Page name for row ${index + 1}`}
                      className="normal-case tracking-normal"
                    />
                  </label>
                  <label className="space-y-1 text-[9px] font-bold uppercase tracking-[0.1em] lg:space-y-0 lg:text-[0px]">
                    URL
                    <div className="flex h-11 border-2 border-[var(--color-black)] bg-white">
                      <span className="flex items-center border-r border-[var(--color-hairline)] px-3 text-sm">/</span>
                      <input
                        value={item.slug}
                        onChange={(event) => update(item.id, { slug: normalizePageSlug(event.target.value) })}
                        aria-label={`URL for ${item.pageName}`}
                        className="min-w-0 flex-1 px-3 text-[13px] font-medium outline-none"
                        placeholder={item.pageType === "home" ? "Home" : "page-url"}
                        disabled={item.pageType === "home"}
                      />
                    </div>
                  </label>
                  <label className="space-y-1 text-[9px] font-bold uppercase tracking-[0.1em] lg:space-y-0 lg:text-[0px]">
                    Title tag
                    <Input
                      value={item.titleTag}
                      onChange={(event) => update(item.id, { titleTag: event.target.value.slice(0, 160) })}
                      aria-label={`Title tag for ${item.pageName}`}
                      className="normal-case tracking-normal"
                    />
                    <span className="block text-right text-[9px] font-medium text-[var(--color-muted)] lg:text-[9px]">{item.titleTag.length}/160</span>
                  </label>
                  <LayoutSelect
                    value={item.layoutRevisionId}
                    layouts={layouts}
                    onChange={(layoutRevisionId) => update(item.id, { layoutRevisionId })}
                    onPreview={setPreviewLayoutId}
                    label={`Layout for ${item.pageName}`}
                    compact
                  />
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${item.pageName} up`}><ArrowUp /></Button>
                    <Button variant="outline" size="icon-sm" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${item.pageName} down`}><ArrowDown /></Button>
                    <Button variant="outline" size="icon-sm" onClick={() => duplicate(index)} aria-label={`Duplicate ${item.pageName}`}><Copy /></Button>
                    <Button variant="destructive" size="icon-sm" onClick={() => remove(index)} aria-label={`Remove ${item.pageName}`}><Trash2 /></Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
                  <span>{pagePath(item.slug)}</span>
                  <span>{layout?.friendlyName ?? "Choose a Ready layout"}</span>
                </div>
                {errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs font-semibold text-[var(--color-red)]">
                    {errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4">
        <span className="text-sm font-bold">{items.length} page{items.length === 1 ? "" : "s"} planned</span>
        <span className={`text-xs font-semibold ${saveState === "error" || !validation.valid ? "text-[var(--color-red)]" : "text-[var(--color-muted)]"}`}>
          {!validation.valid
            ? validation.firstError
            : saveState === "saving"
              ? "Saving Page Plan"
              : saveState === "error"
                ? "Page Plan could not be saved"
                : saveState === "saved"
                  ? "Page Plan saved"
                  : "Ready to save"}
        </span>
      </div>
      <LayoutPreviewDialog
        layout={previewLayout}
        open={Boolean(previewLayout)}
        onOpenChange={(open) => {
          if (!open) setPreviewLayoutId(null);
        }}
      />
    </div>
  );
}

function LayoutSelect({
  value,
  layouts,
  onChange,
  onPreview,
  label,
  compact = false,
}: {
  value: string;
  layouts: LayoutLibraryItem[];
  onChange: (value: string) => void;
  onPreview: (layoutId: string) => void;
  label: string;
  compact?: boolean;
}) {
  const selectedLayout = layouts.find(
    (layout) => (layout.activeRevisionId ?? layout.id) === value,
  );
  return (
    <div className={`${compact ? "space-y-1 text-[9px] lg:space-y-0 lg:text-[0px]" : "space-y-2 text-[10px]"} font-bold uppercase tracking-[0.1em]`}>
      <span className="block">{label}</span>
      <div className="flex gap-1">
        <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
          <SelectTrigger aria-label={label} className="min-w-0 flex-1">
            <SelectValue placeholder="Choose layout">
              {selectedLayout?.friendlyName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {layouts.map((layout) => (
              <SelectItem key={layout.id} value={layout.activeRevisionId ?? layout.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{layout.friendlyName}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                    {layoutCategoryLabel(layout.category)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!selectedLayout}
          onClick={() => {
            if (selectedLayout) onPreview(selectedLayout.id);
          }}
          aria-label={selectedLayout ? `Preview ${selectedLayout.friendlyName}` : "Choose a layout to preview"}
          title="Preview layout"
        >
          <Eye />
        </Button>
      </div>
    </div>
  );
}
