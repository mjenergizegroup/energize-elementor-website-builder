import assert from "node:assert/strict";
import { normalizePageContent } from "./normalize";
import { convertTemplateToAtomic } from "./registry";
import type { MigrationSourcePage } from "../types";

const page: MigrationSourcePage = {
  id: "source-page", sourceUrl: "https://example.com/about", normalizedUrl: "https://example.com/about",
  title: "About", sourceChecksum: "checksum", rawMarkdown: "",
  cleanedMarkdown: "# About Us\n\nFriendly dental care.\n\n[Book](https://example.com/book)",
  classification: "core-page", classificationReason: "site content page", included: true, reviewed: false, metadata: {},
};
const normalized = normalizePageContent(page);
assert.deepEqual(normalized.slots.map((slot) => slot.kind), ["heading", "rich-text", "link"]);
assert.equal(new Set(normalized.slots.map((slot) => slot.id)).size, 3);

const converted = convertTemplateToAtomic({ content: [{
  id: "section-1", elType: "section", settings: {}, elements: [
    { id: "heading-1", elType: "widget", widgetType: "heading", settings: { title: "Welcome", header_size: "h1" }, elements: [] },
    { id: "text-1", elType: "widget", widgetType: "text-editor", settings: { editor: "<p>Body</p>" }, elements: [] },
    { id: "button-1", elType: "widget", widgetType: "button", settings: { text: "Book", link: { url: "/contact" } }, elements: [] },
    { id: "gallery-1", elType: "widget", widgetType: "gallery", settings: { gallery: [] }, elements: [] },
  ],
}] });
assert.equal(converted.adapter.id, "elementor-v3-to-atomic");
assert.equal(converted.converted, 4);
assert.equal(converted.elementorData[0].elType, "e-flexbox");
assert.equal(converted.reviewItems.length, 1);
assert.equal(converted.reviewItems[0].code, "unsupported-widget");
assert.equal(converted.deployable, false);
assert.equal(converted.reviewItems[0].sourceElementId, "gallery-1");

console.log("migration content conversion checks passed");
