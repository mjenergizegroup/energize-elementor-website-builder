import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { analyzeTemplateJson } from "@/lib/template-import/analyze";
import { sanitizeLayoutTemplate } from "./sanitize";

const hostileSource = {
  title: "Old Practice Service Page",
  type: "page",
  version: "0.4",
  page_settings: { post_id: 991, seo_title: "Old Practice Dentist" },
  content: [
    {
      id: "source01",
      elType: "container",
      settings: {
        flex_direction: "column",
        background_color: "#123456",
        background_image: {
          id: 812,
          url: "https://old-practice.example/uploads/hero.jpg",
          alt: "Old Practice office",
        },
        custom_css: ".old-practice { display: block; }",
        __globals__: { background_color: "globals/colors?id=old-blue" },
      },
      elements: [
        {
          id: "source02",
          elType: "widget",
          widgetType: "heading",
          settings: { title: "Old Practice Emergency Dentistry" },
          elements: [],
        },
        {
          id: "source03",
          elType: "widget",
          widgetType: "text-editor",
          settings: {
            editor: "Call Old Practice at 555-555-1212 or old@example.com.",
          },
          elements: [],
        },
        {
          id: "source04",
          elType: "widget",
          widgetType: "button",
          settings: {
            text: "Book at Old Practice",
            link: { url: "https://booking.example.com/old-practice" },
          },
          elements: [],
        },
        {
          id: "source05",
          elType: "widget",
          widgetType: "trustindex-reviews",
          settings: { account: "old-practice" },
          elements: [],
        },
      ],
    },
  ],
};

const sourceText = JSON.stringify(hostileSource);
const analysis = analyzeTemplateJson({
  fileName: "Old-Practice-Service.json",
  sizeBytes: sourceText.length,
  checksum: createHash("sha256").update(sourceText).digest("hex"),
  document: hostileSource,
});
const result = sanitizeLayoutTemplate({
  analysis,
  document: hostileSource,
  fileName: "Old-Practice-Service.json",
});

assert.equal(result.status, "ready");
assert.ok(result.semanticSlots.some((slot) => slot.kind === "heading"));
assert.ok(result.semanticSlots.some((slot) => slot.kind === "body"));
assert.ok(result.semanticSlots.some((slot) => slot.kind === "button-label"));
assert.ok(result.semanticSlots.some((slot) => slot.kind === "link"));
assert.ok(result.semanticSlots.some((slot) => slot.kind === "image"));
assert.deepEqual(result.report.unsupportedWidgetsRemoved, ["trustindex-reviews"]);
assert.equal(result.report.residueMatches.length, 0);
assert.equal(result.report.globalsRemoved, 1);
assert.equal(result.report.customCodeRemoved, 1);

const artifactText = JSON.stringify(result.artifact);
for (const residue of [
  "Old Practice",
  "old-practice.example",
  "booking.example.com",
  "555-555-1212",
  "old@example.com",
  "source01",
  "source02",
  "812",
  "old-blue",
  "trustindex",
  "post_id",
  "seo_title",
]) {
  assert.doesNotMatch(artifactText, new RegExp(residue, "i"));
}
assert.match(artifactText, /ENERGIZE_SLOT/);
assert.match(artifactText, /ENERGIZE_BRAND/);

const unsupportedDocument = { blocks: [{ type: "hero" }] };
const unsupportedText = JSON.stringify(unsupportedDocument);
const unsupported = sanitizeLayoutTemplate({
  analysis: analyzeTemplateJson({
    fileName: "unknown.json",
    sizeBytes: unsupportedText.length,
    checksum: createHash("sha256").update(unsupportedText).digest("hex"),
    document: unsupportedDocument,
  }),
  document: unsupportedDocument,
  fileName: "unknown.json",
});
assert.equal(unsupported.status, "needs_setup");
assert.ok(unsupported.report.blockingReasons.length > 0);

console.log("layout sanitation tests passed");
