"use client";

import { useMemo, useState } from "react";
import { Check, CircleAlert, FilePlus2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PersistedContentMatch } from "@/lib/content-matches/types";
import type { PagePlanItemInput } from "@/lib/page-plan/types";

export function ContentMatchWorkspace({
  pages,
  matches,
  savingPageId,
  onConfirm,
  onRemovePage,
}: {
  pages: PagePlanItemInput[];
  matches: PersistedContentMatch[];
  savingPageId?: string;
  onConfirm: (pagePlanItemId: string, sourcePageId?: string) => Promise<void>;
  onRemovePage: (pagePlanItemId: string) => void;
}) {
  const [choosingFor, setChoosingFor] = useState<string>();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const matchByPage = useMemo(
    () => new Map(matches.map((match) => [match.pagePlanItemId, match])),
    [matches],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-black tracking-[-0.03em]">Content matches</h3>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--color-muted)]">
          The builder matched cleaned website content to your Page Plan. After matching, each page is fitted section by section into its selected layout.
        </p>
      </div>

      <div className="border-2 border-[var(--color-black)]">
        {pages.map((page) => {
          const match = matchByPage.get(page.id);
          const candidate = match?.candidates.find(
            (item) => item.sourcePageId === match.sourcePageId,
          );
          const choosing = choosingFor === page.id || match?.status === "check";
          const selected = selection[page.id] ?? match?.sourcePageId ?? match?.candidates[0]?.sourcePageId ?? "";
          const selectedCandidate = match?.candidates.find(
            (option) => option.sourcePageId === selected,
          );
          return (
            <section
              key={page.id}
              className="border-b border-[var(--color-hairline)] bg-white p-5 last:border-b-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="font-black tracking-[-0.02em]">{page.pageName}</h4>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {page.slug ? `/${page.slug}/` : "/"}
                  </p>
                </div>
                <MatchBadge status={match?.status} />
              </div>

              {match?.status === "matched" && !choosing && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4">
                  <div>
                    <p className="text-sm font-bold">{candidate?.title ?? "Current website content"}</p>
                    {candidate?.path && <p className="mt-1 text-xs text-[var(--color-muted)]">{candidate.path}</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setChoosingFor(page.id)}>
                    Change
                  </Button>
                </div>
              )}

              {match?.status === "empty" && !choosing && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4">
                  <div className="flex items-start gap-3">
                    <FilePlus2 className="mt-0.5 size-4 text-[var(--color-red)]" />
                    <div>
                      <p className="text-sm font-bold">Create an empty draft</p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">You can add or adjust this page in WordPress later.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {match.candidates.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setChoosingFor(page.id)}>
                        Choose content
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onRemovePage(page.id)}>
                      <Trash2 data-icon="inline-start" /> Remove page
                    </Button>
                  </div>
                </div>
              )}

              {choosing && match && (
                <div className="mt-4 border-2 border-[var(--color-black)] bg-[var(--color-red-light)] p-4">
                  <p className="text-sm font-black">
                    Which current page contains the content for {page.pageName}?
                  </p>
                  {match.candidates.length > 0 ? (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Select
                          value={selected}
                          onValueChange={(value) => setSelection((current) => ({ ...current, [page.id]: value ?? "" }))}
                        >
                          <SelectTrigger aria-label={`Current page for ${page.pageName}`}>
                            <SelectValue>
                              {() => selectedCandidate
                                ? `${selectedCandidate.title} (${selectedCandidate.path})`
                                : "Choose current page"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {match.candidates.map((option) => (
                              <SelectItem key={option.sourcePageId} value={option.sourcePageId}>
                                {option.title} ({option.path})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          disabled={!selected || savingPageId === page.id}
                          onClick={async () => {
                            await onConfirm(page.id, selected);
                            setChoosingFor(undefined);
                          }}
                        >
                          {savingPageId === page.id ? "Saving" : "Use this page"}
                        </Button>
                      </div>
                      {selectedCandidate?.preview && (
                        <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--color-muted)]">
                          {selectedCandidate.preview}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--color-muted)]">No other useful current pages were found.</p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingPageId === page.id}
                      onClick={async () => {
                        await onConfirm(page.id);
                        setChoosingFor(undefined);
                      }}
                    >
                      Create empty draft
                    </Button>
                    {match.status !== "check" && (
                      <Button variant="ghost" size="sm" onClick={() => setChoosingFor(undefined)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {!match && (
                <div className="mt-4 flex items-center gap-3 border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4 text-sm font-bold">
                  <RefreshCw className="size-4" /> Waiting for content import
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MatchBadge({ status }: { status?: PersistedContentMatch["status"] }) {
  if (status === "matched") {
    return (
      <span className="inline-flex items-center gap-2 border-2 border-[var(--color-black)] bg-[var(--color-black)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
        <Check className="size-3.5" /> Matched
      </span>
    );
  }
  if (status === "check") {
    return (
      <span className="inline-flex items-center gap-2 border-2 border-[var(--color-red)] bg-[var(--color-red-light)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-red)]">
        <CircleAlert className="size-3.5" /> Check match
      </span>
    );
  }
  if (status === "empty") {
    return (
      <span className="border-2 border-[var(--color-black)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em]">
        No source content
      </span>
    );
  }
  return <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted)]">Waiting</span>;
}
