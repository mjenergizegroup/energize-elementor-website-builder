import assert from "node:assert/strict";
import type { TemplateCompileBundle } from "@/lib/template-import/types";
import { buildDependencyLedger, migrationReadiness } from "./dependencies";

const bundle = { pages: [{
  analysisId: "home", mapping: { title: "Home" }, targetKind: "wp-page",
  pending: { externalHosts: ["source.example.com"], customGlobalIds: ["g-1"], plugins: ["forms"], unsupportedWidgets: ["gallery"], shortcodes: ["[form]"] },
  transformations: { mediaIdsCleared: 2, dynamicBindingsPreserved: 1 },
}, {
  analysisId: "post", mapping: { title: "Blog Post" }, targetKind: "elementor-theme-template",
  pending: { externalHosts: ["source.example.com"], customGlobalIds: [], plugins: [], unsupportedWidgets: [], shortcodes: [] },
  transformations: { mediaIdsCleared: 0, dynamicBindingsPreserved: 0 },
}] } as unknown as TemplateCompileBundle;

const ledger = buildDependencyLedger(bundle);
assert.equal(ledger.length, 8);
assert.equal(ledger.filter((item) => item.kind === "external-url").length, 1);
assert.equal(migrationReadiness(ledger).ready, false);
const resolved = ledger.map((item) => ({ ...item, status: "resolved" as const }));
assert.equal(migrationReadiness(resolved).ready, true);
assert.equal(migrationReadiness([{ ...resolved[0], status: "blocked" }]).blocked, 1);

console.log("migration dependency checks passed");
