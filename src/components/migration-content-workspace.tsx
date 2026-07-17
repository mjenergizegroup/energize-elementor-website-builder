"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  MigrationSourcePage,
  SourcePageClassification,
} from "@/lib/migration/types";
import type { MigrationSourcePageUpdate } from "@/lib/migration/content/review";

export function MigrationContentWorkspace({
  pages,
  saving,
  onChange,
  onSave,
}: {
  pages: MigrationSourcePage[];
  saving: boolean;
  onChange: (pages: MigrationSourcePage[]) => void;
  onSave: (updates: MigrationSourcePageUpdate[]) => Promise<void>;
}) {
  const [activePageId, setActivePageId] = useState(pages[0]?.id ?? "");
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const summary = useMemo(() => {
    const included = pages.filter((page) => page.included);
    return {
      included: included.length,
      approved: included.filter((page) => page.reviewed).length,
      needsReview: included.filter((page) => !page.reviewed).length,
    };
  }, [pages]);

  useEffect(() => {
    if (!pages.some((page) => page.id === activePageId)) {
      setActivePageId(pages[0]?.id ?? "");
    }
  }, [activePageId, pages]);

  function updatePage(pageId: string, patch: Partial<MigrationSourcePage>) {
    onChange(
      pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
    );
  }

  async function savePage(reviewed: boolean) {
    if (!activePage) return;
    await onSave([
      {
        id: activePage.id,
        title: activePage.title,
        approvedMarkdown: activePage.approvedMarkdown,
        included: activePage.included,
        reviewed,
      },
    ]);
  }

  async function approveIncludedPages() {
    await onSave(
      pages
        .filter((page) => page.included && page.approvedMarkdown.trim())
        .map((page) => ({
          id: page.id,
          title: page.title,
          approvedMarkdown: page.approvedMarkdown,
          included: true,
          reviewed: true,
        })),
    );
  }

  if (!activePage) {
    return (
      <div className="border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm text-[var(--muted)]">
        No stored source pages are available for review.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[var(--paper-2)] p-4">
        <div className="flex flex-wrap gap-2" aria-label="Content review summary">
          <Badge variant="secondary">{summary.included} included</Badge>
          <Badge variant="secondary">{summary.approved} approved</Badge>
          <Badge variant={summary.needsReview > 0 ? "outline" : "default"}>
            {summary.needsReview} need review
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={saving || summary.included === 0 || summary.needsReview === 0}
          onClick={() => void approveIncludedPages()}
        >
          <Check data-icon="inline-start" />
          Approve included pages
        </Button>
      </div>

      <div className="grid min-h-[520px] border border-[var(--line)] bg-[var(--card)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-[var(--line)] bg-[var(--paper-2)] lg:border-r lg:border-b-0">
          <div className="border-b border-[var(--line)] p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Stored source pages</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Raw content stays unchanged. Edits apply only to the approved draft.
            </p>
          </div>
          <div className="max-h-[620px] overflow-auto p-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePageId(page.id)}
                aria-current={page.id === activePage.id ? "page" : undefined}
                className={`mb-1 w-full border p-3 text-left transition-colors ${
                  page.id === activePage.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-transparent hover:border-[var(--line)] hover:bg-[var(--card)]"
                }`}
              >
                <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                  {page.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {classificationLabel(page.classification)}
                  {page.reviewed ? (
                    <span className="text-[var(--good)]">Approved</span>
                  ) : page.included ? (
                    <span className="text-[var(--primary-deep)]">Review</span>
                  ) : (
                    <span>Excluded</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--muted)]">
                {activePage.normalizedUrl}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Revision {activePage.contentRevision} - {activePage.classificationReason}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <input
                type="checkbox"
                checked={activePage.included}
                onChange={(event) =>
                  updatePage(activePage.id, {
                    included: event.target.checked,
                    reviewed: event.target.checked ? activePage.reviewed : false,
                    approvedChecksum: event.target.checked
                      ? activePage.approvedChecksum
                      : undefined,
                    approvedAt: event.target.checked ? activePage.approvedAt : undefined,
                  })
                }
              />
              Include this page
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`source-title-${activePage.id}`}>Destination title</Label>
            <Input
              id={`source-title-${activePage.id}`}
              value={activePage.title}
              onChange={(event) =>
                updatePage(activePage.id, {
                  title: event.target.value,
                  reviewed: false,
                  approvedChecksum: undefined,
                  approvedAt: undefined,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={`approved-content-${activePage.id}`}>Approved content draft</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  updatePage(activePage.id, {
                    approvedMarkdown: activePage.cleanedMarkdown,
                    reviewed: false,
                    approvedChecksum: undefined,
                    approvedAt: undefined,
                  })
                }
              >
                <RotateCcw data-icon="inline-start" />
                Restore cleaned version
              </Button>
            </div>
            <Textarea
              id={`approved-content-${activePage.id}`}
              value={activePage.approvedMarkdown}
              className="min-h-[300px] font-mono text-xs leading-5"
              onChange={(event) =>
                updatePage(activePage.id, {
                  approvedMarkdown: event.target.value,
                  reviewed: false,
                  approvedChecksum: undefined,
                  approvedAt: undefined,
                })
              }
            />
            <p className="text-xs leading-5 text-[var(--muted)]">
              Editing this draft removes its approval until you save and approve it again.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <details className="border border-[var(--line)] bg-[var(--paper-2)] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">
                View deterministic cleanup
              </summary>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">
                {activePage.cleanedMarkdown}
              </pre>
            </details>
            <details className="border border-[var(--line)] bg-[var(--paper-2)] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">
                View immutable raw crawl
              </summary>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">
                {activePage.rawMarkdown}
              </pre>
            </details>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void savePage(false)}
            >
              <Save data-icon="inline-start" />
              Save draft
            </Button>
            <Button
              type="button"
              disabled={saving || !activePage.included || !activePage.approvedMarkdown.trim()}
              onClick={() => void savePage(true)}
            >
              <Check data-icon="inline-start" />
              Save and approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function classificationLabel(value: SourcePageClassification): string {
  if (value === "core-page") return "Core page";
  if (value === "blog-post") return "Blog post";
  if (value === "blog-index") return "Blog index";
  return "Skipped";
}
