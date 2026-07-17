import assert from "node:assert/strict";
import { normalizePageContent } from "./normalize";
import { convertTemplateToAtomic } from "./registry";
import { injectNormalizedContent } from "./inject";
import {
  contentMappingsToSourcePages,
  mapStructuredPagesToTemplates,
  resolveContentImageUrls,
} from "./structured";
import { remapContentMedia } from "./media";
import type { MigrationSourcePage } from "../types";
import type { TemplateCompileBundle } from "@/lib/template-import/types";

const page: MigrationSourcePage = {
  id: "source-page", sourceUrl: "https://example.com/about", normalizedUrl: "https://example.com/about",
  title: "About", sourceChecksum: "checksum", rawMarkdown: "",
  cleanedMarkdown: "# About Us\n\nFriendly dental care.\n\n[Book](https://example.com/book)",
  approvedMarkdown: "# About Us\n\nFriendly dental care.\n\n[Book](https://example.com/book)",
  contentRevision: 1,
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
assert.deepEqual(
  (converted.elementorData[0].settings.classes as { value: string[] }).value,
  ["e-gc-section"],
);

const injected = injectNormalizedContent(converted.elementorData, normalized);
const injectedJson = JSON.stringify(injected.elementorData);
assert.equal(injected.replaced, 3);
assert.doesNotMatch(injectedJson, /Welcome|<p>Body<\/p>/);
assert.match(injectedJson, /About Us/);
assert.match(injectedJson, /Friendly dental care/);
assert.match(injectedJson, /https:\/\/example.com\/book/);

const mapped = mapStructuredPagesToTemplates(
  {
    pages: [
      {
        analysisId: "about-template",
        mapping: {
          selected: true,
          role: "about",
          title: "About",
          slug: "about",
        },
      },
    ],
  } as unknown as TemplateCompileBundle,
  [
    {
      page: "about",
      wpTitle: "About Our Practice",
      slug: "about",
      builderPageType: "about",
      selected: true,
      pageData: {
        hero: {
          heading: "Meet Our Team",
          body: "Friendly care.",
          image_url: "https://example.com/team.jpg",
          image_alt: "Dental care team",
        },
      },
    },
  ],
);
assert.deepEqual(mapped.errors, []);
assert.equal(mapped.mappings[0].analysisId, "about-template");
assert.deepEqual(
  mapped.mappings[0].content.slots.map((slot) => slot.kind),
  ["heading", "rich-text", "image"],
);
assert.equal(
  mapped.mappings[0].content.slots.find((slot) => slot.kind === "image")
    ?.altText,
  "Dental care team",
);
assert.equal(remapContentMedia(mapped.mappings, []).blockers.length, 1);
const mediaMapped = remapContentMedia(mapped.mappings, [
  {
    id: "team-image",
    sourceUrl: "https://example.com/team.jpg",
    originalUrl: "https://example.com/team.jpg",
    sourcePageIds: ["about"],
    status: "uploaded",
    included: true,
    discoveredAltText: "Dental care team",
    altText: "Our dental care team",
    title: "Dental care team",
    filename: "dental-care-team-12345678.jpg",
    attemptCount: 1,
    destinationMediaId: 42,
    destinationUrl: "https://wp.example.com/dental-care-team.jpg",
  },
]);
assert.deepEqual(mediaMapped.blockers, []);
assert.equal(
  mediaMapped.mappings[0].content.slots.find((slot) => slot.kind === "image")
    ?.sourceUrl,
  "https://wp.example.com/dental-care-team.jpg",
);
const sourcePages = contentMappingsToSourcePages(
  mapped.mappings,
  "https://source.example.com/",
);
assert.equal(sourcePages[0].url, "https://source.example.com/about");
assert.match(sourcePages[0].markdown, /!\[Dental care team\]\(https:\/\/example.com\/team.jpg\)/);
const relativeMappings = structuredClone(mapped.mappings);
const relativeImage = relativeMappings[0].content.slots.find(
  (slot) => slot.kind === "image",
);
if (relativeImage?.kind === "image") relativeImage.sourceUrl = "/team.jpg";
assert.equal(
  resolveContentImageUrls(
    relativeMappings,
    "https://source.example.com/about/",
  )[0].content.slots.find((slot) => slot.kind === "image")?.sourceUrl,
  "https://source.example.com/team.jpg",
);

console.log("migration content conversion checks passed");
