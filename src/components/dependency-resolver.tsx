"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { TemplateCompileBundle } from "@/lib/template-import/types";
import {
  migrationReadiness,
  reconcileDependencyLedger,
} from "@/lib/migration/dependencies";
import type { MigrationResolution } from "@/lib/migration/types";

const EMPTY_RESOLUTIONS: MigrationResolution[] = [];

export function DependencyResolver({ bundle, initialItems, onChange }: {
  bundle: TemplateCompileBundle;
  initialItems?: MigrationResolution[];
  onChange?: (items: MigrationResolution[]) => void;
}) {
  const seed = useMemo(
    () => reconcileDependencyLedger(bundle, initialItems ?? EMPTY_RESOLUTIONS),
    [bundle, initialItems],
  );
  const [items, setItems] = useState(seed);
  useEffect(() => { setItems(seed); onChange?.(seed); }, [seed, onChange]);
  const readiness = migrationReadiness(items);
  function update(id: string, status: MigrationResolution["status"]) {
    const next = items.map((item) => item.id === id ? { ...item, status } : item);
    setItems(next);
    onChange?.(next);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <Badge variant={readiness.ready ? "default" : "secondary"}>{readiness.ready ? "Deployment ready" : "Resolution required"}</Badge>
        <Badge variant="outline">{readiness.unresolved} unresolved</Badge>
        <Badge variant={readiness.blocked ? "destructive" : "outline"}>{readiness.blocked} blocked</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No unresolved dependencies were detected.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--paper-2)] p-4 sm:grid-cols-[1fr_180px] sm:items-center">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-primary-hover)]">{item.kind.replace(/-/g, " ")}</p>
                <p className="truncate text-sm font-semibold">{item.source}</p>
                {item.note && <p className="text-xs text-[var(--color-text-secondary)]">{item.note}</p>}
              </div>
              <select aria-label={`Resolution for ${item.source}`} value={item.status} onChange={(event) => update(item.id, event.target.value as MigrationResolution["status"])} className="h-10 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3 text-sm font-semibold shadow-xs focus:border-[var(--color-primary)] focus:outline-none">
                <option value="unresolved">Needs resolution</option>
                <option value="resolved">Resolved with mapping</option>
                <option value="accepted">Accepted exception</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
