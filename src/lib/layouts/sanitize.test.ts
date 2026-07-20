import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { analyzeTemplateJson } from "@/lib/template-import/analyze";
import { scanPreparedLayoutResidue } from "./residue";
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
        background_overlay_opacity: { unit: "px", size: 0.45, sizes: [] },
        _padding_mobile: { unit: "px", top: "24", right: "16", bottom: "24", left: "16" },
        custom_css: ".old-practice { display: block; }",
        __globals__: { background_color: "globals/colors?id=old-blue" },
      },
      elements: [
        {
          id: "source02",
          elType: "widget",
          widgetType: "heading",
          settings: {
            title: "Old Practice Emergency Dentistry",
            __globals__: { title_color: "globals/colors?id=primary" },
          },
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
          widgetType: "icon-box",
          settings: {
            title_text: "Old Practice benefit",
            description_text: "Old Practice benefit description",
            selected_icon: { value: "fas fa-tooth", library: "fa-solid" },
            image_border_radius: { unit: "px", top: "12", right: "12", bottom: "12", left: "12" },
          },
          elements: [],
        },
        {
          id: "source06",
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
assert.equal(result.report.globalsRemoved, 2);
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
assert.match(artifactText, /ENERGIZE_BRAND:primary/);
assert.match(artifactText, /background_overlay_opacity/);
assert.match(artifactText, /_padding_mobile/);
assert.match(artifactText, /fas fa-tooth/);
assert.match(artifactText, /image_border_radius/);
assert.equal(
  result.semanticSlots.filter((slot) => slot.kind === "image").length,
  1,
);
assert.ok(
  result.semanticSlots.some(
    (slot) => slot.settingKey === "title_text" && slot.kind === "heading",
  ),
);
assert.ok(
  result.semanticSlots.some(
    (slot) => slot.settingKey === "description_text" && slot.kind === "body",
  ),
);

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

const sourceIdFingerprint = {
  kind: "id" as const,
  digest: createHash("sha256").update("source01").digest("hex"),
  length: 8,
};
assert.deepEqual(
  scanPreparedLayoutResidue({ id: "source01", settings: {} }, [sourceIdFingerprint]),
  [],
);
assert.deepEqual(
  scanPreparedLayoutResidue(
    { id: "fresh-id", settings: { copiedValue: "source01" } },
    [sourceIdFingerprint],
  ),
  ["source id"],
);

console.log("layout sanitation tests passed");
