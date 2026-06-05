/**
 * Generates sample build outputs for use as fixtures / regression baselines.
 * Run: tsx generate-sample-output.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../../parser";
import { buildElevatePage } from "./index";
import type { ElementorJSON } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

const content = readFileSync(join(__dirname, "__fixtures__", "sample-content.md"), "utf-8");
const parsed = parse(content);

function loadTemplate(name: string): ElementorJSON {
  return JSON.parse(
    readFileSync(join(REPO_ROOT, "theme-templates", "elevate", `${name}.json`), "utf-8")
  ) as ElementorJSON;
}

const outputs: Record<string, unknown> = {};

// Homepage
const home = buildElevatePage({
  pageType: "homepage",
  site: parsed.site,
  pageData: parsed.pages.homepage,
  template: loadTemplate("homepage"),
});
outputs["homepage"] = { warnings: home.warnings, buildNotes: home.buildNotes };

// Service page
const sp = buildElevatePage({
  pageType: "service-page",
  slug: "cosmetic-dentistry",
  site: parsed.site,
  pageData: parsed.service_pages["cosmetic-dentistry"],
  template: loadTemplate("service-page"),
});
outputs["service-page-cosmetic-dentistry"] = {
  warnings: sp.warnings,
  buildNotes: sp.buildNotes,
};

// Contact
const contact = buildElevatePage({
  pageType: "contact",
  site: parsed.site,
  pageData: parsed.pages.contact,
  template: loadTemplate("contact"),
});
outputs["contact"] = { warnings: contact.warnings, buildNotes: contact.buildNotes };

writeFileSync(
  join(__dirname, "__fixtures__", "build-output-summary.json"),
  JSON.stringify(outputs, null, 2)
);
writeFileSync(
  join(__dirname, "__fixtures__", "homepage-built.json"),
  JSON.stringify(home.json, null, 2)
);

console.log("Generated sample outputs:");
console.log("  __fixtures__/build-output-summary.json");
console.log("  __fixtures__/homepage-built.json");
console.log("");
console.log("Homepage build:");
console.log(`  ${home.warnings.length} warnings`);
home.warnings.forEach((w) => console.log(`    [warn] ${w}`));
console.log(`  ${home.buildNotes.length} build notes`);
home.buildNotes.forEach((n) => console.log(`    ${n}`));
