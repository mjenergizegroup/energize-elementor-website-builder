"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { TemplateCompileBundle } from "@/lib/template-import/types";
import { buildDependencyLedger, migrationReadiness } from "@/lib/migration/dependencies";
import type { MigrationResolution } from "@/lib/migration/types";

export function DependencyResolver({ bundle, onChange }: {
  bundle: TemplateCompileBundle;
  onChange?: (items: MigrationResolution[]) => void;
}) {
  const seed = useMemo(() => buildDependencyLedger(bundle), [bundle]);
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
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={readiness.ready ? "default" : "secondary"}>{readiness.ready ? "Deployment ready" : "Resolution required"}</Badge>
        <Badge variant="outline">{readiness.unresolved} unresolved</Badge>
        <Badge variant={readiness.blocked ? "destructive" : "outline"}>{readiness.blocked} blocked</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No unresolved dependencies were detected.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 border border-[var(--line)] bg-[var(--paper-2)] p-3 sm:grid-cols-[1fr_180px] sm:items-center">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-red)]">{item.kind.replace(/-/g, " ")}</p>
                <p className="truncate text-sm font-semibold">{item.source}</p>
                {item.note && <p className="text-xs text-[var(--color-muted)]">{item.note}</p>}
              </div>
              <select aria-label={`Resolution for ${item.source}`} value={item.status} onChange={(event) => update(item.id, event.target.value as MigrationResolution["status"])} className="h-10 border-2 border-[var(--color-black)] bg-[var(--color-surface)] px-3 text-sm font-semibold">
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
