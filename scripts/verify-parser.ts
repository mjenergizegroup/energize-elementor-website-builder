// Parse the real Anchor Periodontics sample and inject every page.
// Run with: npx tsx scripts/verify-parser.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseContent } from "../src/lib/parser";
import { getInjector } from "../src/lib/injection/registry";

const sample = readFileSync(
  join(process.cwd(), "reference-skills", "anchor-periodontics-elevate-content.md"),
  "utf8",
);

const content = parseContent({
  theme: "elevate",
  markdown: sample,
  pages: [],
});

console.log("Practice:", content.practiceName);
console.log("Doctor:", content.doctorName);
console.log("City:", content.city);
console.log("Pages parsed:", content.pages.map((p) => `${p.page}(${p.slug})`).join(", "));
console.log("");

const elevate = getInjector("elevate");
let totalMissing = 0;

for (const page of content.pages) {
  const injected = elevate.injectPage(page.page, page, {
    practiceName: content.practiceName,
  });
  const missing = injected.warnings.filter((w) => w.startsWith("[MISSING"));
  const nodeWarn = injected.warnings.filter((w) => !w.startsWith("[MISSING"));
  const slotCount = Object.keys(page.slots).length;
  console.log(
    `${page.page} "${page.wpTitle}" -> ${slotCount} slots filled, ${missing.length} missing, ${nodeWarn.length} node warnings`,
  );
  if (missing.length) console.log("   " + missing.join("\n   "));
  if (nodeWarn.length) console.log("   " + nodeWarn.join("\n   "));
  totalMissing += missing.length;
}

console.log("");

// Spot checks.
const serviceCount = content.pages.filter((p) => p.page === "services").length;
const homepage = content.pages.find((p) => p.page === "homepage")!;
const contact = content.pages.find((p) => p.page === "contact")!;

const checks: [string, boolean][] = [
  ["homepage hero headline parsed", homepage.slots["hero_headline"] === "Specialty Periodontal Care, Anchored in Expertise"],
  ["homepage hero body is HTML", typeof homepage.slots["hero_body"] === "string" && (homepage.slots["hero_body"] as string).startsWith("<p>")],
  ["homepage has 6 service cards", [1,2,3,4,5,6].every((n) => homepage.slots[`services_card${n}`] !== undefined)],
  ["service card 1 has title+desc", typeof homepage.slots["services_card1"] === "object"],
  ["3 service pages parsed", serviceCount === 3],
  ["doctor name extracted", content.doctorName?.includes("Polak") ?? false],
  ["contact location 1 heading", contact.slots["loc1_heading"] === "Stevensville"],
  ["contact location 1 phone", contact.slots["loc1_phone"] === "410-604-9555"],
  ["promo panel 1 heading parsed", homepage.slots["promo1_heading"] !== undefined],
  ["closing quote parsed", typeof homepage.slots["dentist_quote"] === "string"],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}

console.log(`\nTotal required-missing slots across all pages: ${totalMissing}`);
console.log(failed === 0 ? "SPOT CHECKS PASSED" : `${failed} SPOT CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
