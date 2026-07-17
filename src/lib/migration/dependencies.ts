import type { TemplateCompileBundle } from "@/lib/template-import/types";
import type { MigrationResolution } from "./types";

export interface MigrationReadiness {
  ready: boolean;
  unresolved: number;
  blocked: number;
  resolved: number;
  reasons: string[];
}

export function buildDependencyLedger(bundle: TemplateCompileBundle): MigrationResolution[] {
  const items = new Map<string, MigrationResolution>();
  const add = (kind: MigrationResolution["kind"], source: string, note: string) => {
    const key = `${kind}:${source}`;
    if (items.has(key)) return;
    items.set(key, {
      id: stableId(key),
      kind,
      source,
      status: "unresolved",
      note,
    });
  };
  for (const page of bundle.pages) {
    for (const host of page.pending.externalHosts) add("external-url", host, `Referenced by ${page.mapping.title}.`);
    for (const id of page.pending.customGlobalIds) add("global-style", id, `Map this source global for ${page.mapping.title}.`);
    for (const plugin of page.pending.plugins) add("plugin", plugin, `Confirm this plugin on the destination.`);
    for (const widget of page.pending.unsupportedWidgets) add("widget", widget, `Convert or explicitly preserve this widget.`);
    for (const shortcode of page.pending.shortcodes) add("shortcode", shortcode, `Confirm its destination provider.`);
    if (page.transformations.mediaIdsCleared > 0) add("media", page.analysisId, `${page.transformations.mediaIdsCleared} media reference(s) require mapping.`);
    if (page.transformations.dynamicBindingsPreserved > 0) add("dynamic-binding", page.analysisId, `${page.transformations.dynamicBindingsPreserved} dynamic binding(s) require context.`);
    if (page.targetKind === "elementor-theme-template") add("theme-builder-target", page.analysisId, `Set display conditions for ${page.mapping.title}.`);
  }
  return [...items.values()];
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `dependency-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function migrationReadiness(items: MigrationResolution[]): MigrationReadiness {
  const unresolved = items.filter((item) => item.status === "unresolved").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const resolved = items.length - unresolved - blocked;
  const reasons = items
    .filter((item) => item.status === "unresolved" || item.status === "blocked")
    .map((item) => `${item.kind}: ${item.source}`);
  return { ready: unresolved === 0 && blocked === 0, unresolved, blocked, resolved, reasons };
}
