import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { analyzeTemplateJson } from "@/lib/template-import/analyze";
import { sanitizeLayoutTemplate } from "@/lib/layouts/sanitize";
import type { PersistedContentMatch } from "@/lib/content-matches/types";
import type { MigrationSourcePage } from "@/lib/migration/types";
import type { PagePlanItemInput } from "@/lib/page-plan/types";
import { preparePageDraft } from "./prepare";

const template = {
  title: "Layout Donor Service",
  type: "page",
  version: "0.4",
  content: [
    {
      id: "donor-section",
      elType: "container",
      settings: {
        flex_direction: "column",
        padding: { unit: "px", top: "80", right: "24", bottom: "80", left: "24" },
      },
      elements: [
        { id: "donor-title", elType: "widget", widgetType: "heading", settings: { title: "Layout Donor Dentistry", header_size: "h1" }, elements: [] },
        { id: "donor-body", elType: "widget", widgetType: "text-editor", settings: { editor: "Template donor body copy." }, elements: [] },
        { id: "donor-button", elType: "widget", widgetType: "button", settings: { text: "Book Layout Donor", link: { url: "https://donor.example/book" } }, elements: [] },
        { id: "donor-image", elType: "widget", widgetType: "image", settings: { image: { id: 818, url: "https://donor.example/donor.jpg", alt: "Donor office" } }, elements: [] },
      ],
    },
  ],
};
const templateText = JSON.stringify(template);
const sanitized = sanitizeLayoutTemplate({
  analysis: analyzeTemplateJson({
    fileName: "Layout-Donor-Service.json",
    sizeBytes: templateText.length,
    checksum: createHash("sha256").update(templateText).digest("hex"),
    document: template,
  }),
  document: template,
  fileName: "Layout-Donor-Service.json",
});
assert.equal(sanitized.status, "ready");

function page(
  id: string,
  pageName: string,
  slug: string,
  pageType: PagePlanItemInput["pageType"],
): PagePlanItemInput {
  return {
    id,
    position: 0,
    pageName,
    slug,
    titleTag: `${pageName} | J. Bradford Smith, DDS`,
    pageType,
    layoutRevisionId: "layout-revision-1",
    emptyDraftAllowed: true,
    status: "matched",
  };
}

function source(
  id: string,
  title: string,
  path: string,
  markdown: string,
): MigrationSourcePage {
  return {
    id,
    sourceUrl: `https://old-client.test${path}`,
    normalizedUrl: `https://old-client.test${path}`,
    title,
    sourceChecksum: createHash("sha256").update(markdown).digest("hex"),
    rawMarkdown: markdown,
    cleanedMarkdown: markdown,
    approvedMarkdown: markdown,
    contentRevision: 3,
    classification: "core-page",
    classificationReason: "site content page",
    included: true,
    reviewed: false,
    metadata: {},
  };
}

function match(pagePlanItemId: string, sourcePageId: string): PersistedContentMatch {
  return {
    id: `match-${pagePlanItemId}`,
    pagePlanItemId,
    sourcePageId,
    score: 100,
    signals: ["Same URL path"],
    candidates: [],
    status: "matched",
    confirmedByUser: false,
    normalizedContentRevision: 3,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
}

const servicePlan = page("service-plan", "Emergency Dentistry", "emergency-dentistry", "service");
const contactPlan = page("contact-plan", "Contact Us", "contact-us", "contact");
const serviceSource = source(
  "service-source",
  "Emergency Dentist Columbia",
  "/services/emergency-dentistry/",
  [
    "# Emergency Dentist in Columbia",
    "Fast, compassionate dental care when you need it.",
    "## Same-Day Help",
    "Call our team for urgent dental needs.",
    "[Contact us](https://old-client.test/contact-us/?utm_source=old)",
    "![Dental treatment room](https://old-client.test/uploads/emergency.jpg)",
    "## What to Expect",
    "We will explain every step of your visit.",
  ].join("\n\n"),
);
const contactSource = source(
  "contact-source",
  "Contact Us",
  "/contact-us/",
  "# Contact Us\n\nReach our team.",
);
const matches = [match(servicePlan.id, serviceSource.id), match(contactPlan.id, contactSource.id)];

const prepared = preparePageDraft({
  page: servicePlan,
  match: matches[0],
  sourcePage: serviceSource,
  layoutRevision: {
    id: "layout-revision-1",
    status: "ready",
    sanitizedArtifact: sanitized.artifact,
    semanticSlots: sanitized.semanticSlots,
    identityFingerprints: sanitized.identityFingerprints,
  },
  pagePlan: [servicePlan, contactPlan],
  matches,
  sourcePages: [serviceSource, contactSource],
  assets: [
    {
      id: "emergency-image",
      sourceUrl: "https://old-client.test/uploads/emergency.jpg",
      originalUrl: "https://old-client.test/uploads/emergency.jpg",
      sourcePageIds: [serviceSource.id],
      status: "uploaded",
      included: true,
      discoveredAltText: "Dental treatment room",
      altText: "Emergency dental treatment room",
      title: "Emergency dental treatment room",
      filename: "emergency-dental-treatment-room.jpg",
      attemptCount: 1,
      destinationMediaId: 41,
      destinationUrl: "https://destination.test/uploads/emergency-room.jpg",
    },
  ],
  workspace: {
    schemaVersion: 1,
    step: 3,
    siteKind: "existing",
    deployMode: "pages",
    name: "J. Bradford Smith, DDS",
    slug: "j-bradford-smith-dds",
    address: "",
    phone: "8035551212",
    email: "team@destination.test",
    hours: "",
    bookingLink: "https://destination.test/request-appointment/",
    social: "",
    siteUrl: "https://destination.test/",
    username: "websites@example.com",
    colors: { primary: "#111111", secondary: "#222222", accent: "#cc2222", text: "#111111", background: "#ffffff" },
    fonts: { heading: "Poppins", body: "Inter" },
  },
});

const artifact = JSON.stringify(prepared.artifact);
assert.equal(prepared.status, "ready");
assert.equal(prepared.residueReport.length, 0);
assert.match(artifact, /Emergency Dentistry/);
assert.match(artifact, /Fast, compassionate dental care/);
assert.match(artifact, /\/contact-us\//);
assert.match(artifact, /destination\.test\/uploads\/emergency-room\.jpg/);
assert.doesNotMatch(artifact, /Layout Donor|donor\.example|donor\.jpg|"id":818/);
assert.doesNotMatch(artifact, /old-client\.test\/uploads\/emergency\.jpg/);
assert.doesNotMatch(artifact, /ENERGIZE_SLOT|ENERGIZE_BRAND/);
assert.ok(prepared.appendedSlots > 0);
assert.equal(prepared.adapterId, "elementor-v3-preserved");
assert.equal(prepared.adapterVersion, "1");
assert.ok(prepared.notes.some((note) => /matching content section/.test(note)));
const preservedRoot = prepared.artifact[0] as {
  id: string;
  elType: string;
  settings: Record<string, unknown>;
};
assert.equal(preservedRoot.elType, "container");
assert.match(preservedRoot.id, /^[a-f0-9]{8}$/);
assert.equal(preservedRoot.settings.flex_direction, "column");
assert.deepEqual(preservedRoot.settings.padding, {
  unit: "px",
  top: "80",
  right: "24",
  bottom: "80",
  left: "24",
});
assert.ok(prepared.notes.some((note) => /original Elementor structure/.test(note)));

const emptyMatch: PersistedContentMatch = {
  ...match("empty-plan", "unused"),
  pagePlanItemId: "empty-plan",
  sourcePageId: undefined,
  normalizedContentRevision: undefined,
  status: "empty",
};
const empty = preparePageDraft({
  page: page("empty-plan", "Membership", "membership", "standard"),
  match: emptyMatch,
  layoutRevision: {
    id: "layout-revision-1",
    status: "ready",
    sanitizedArtifact: sanitized.artifact,
    semanticSlots: sanitized.semanticSlots,
    identityFingerprints: sanitized.identityFingerprints,
  },
  pagePlan: [],
  matches: [],
  sourcePages: [],
  assets: [],
});
assert.equal(empty.status, "ready");
assert.match(JSON.stringify(empty.artifact), /Membership/);
assert.match(JSON.stringify(empty.artifact), /Add image in WordPress/);
assert.doesNotMatch(JSON.stringify(empty.artifact), /ENERGIZE_SLOT/);
assert.ok(empty.removedPlaceholders > 0);

const sectionTemplate = {
  ...template,
  content: [
    {
      id: "hero-section",
      elType: "container",
      settings: {},
      elements: [
        { id: "hero-title", elType: "widget", widgetType: "heading", settings: { title: "Old hero", header_size: "h1" }, elements: [] },
        { id: "hero-body", elType: "widget", widgetType: "text-editor", settings: { editor: "Old hero body" }, elements: [] },
      ],
    },
    {
      id: "help-section",
      elType: "container",
      settings: {},
      elements: [
        { id: "help-title", elType: "widget", widgetType: "heading", settings: { title: "Old help title", header_size: "h2" }, elements: [] },
        { id: "help-list", elType: "widget", widgetType: "icon-list", settings: { icon_list: [{ text: "Old list item" }] }, elements: [] },
      ],
    },
    {
      id: "expect-section",
      elType: "container",
      settings: {},
      elements: [
        { id: "expect-box", elType: "widget", widgetType: "icon-box", settings: { title: "Old expectation", description: "Old description" }, elements: [] },
      ],
    },
  ],
};
const sectionTemplateText = JSON.stringify(sectionTemplate);
const sectionLayout = sanitizeLayoutTemplate({
  analysis: analyzeTemplateJson({
    fileName: "Section-Service.json",
    sizeBytes: sectionTemplateText.length,
    checksum: createHash("sha256").update(sectionTemplateText).digest("hex"),
    document: sectionTemplate,
  }),
  document: sectionTemplate,
  fileName: "Section-Service.json",
});
assert.equal(sectionLayout.status, "ready");
const sectionPrepared = preparePageDraft({
  page: servicePlan,
  match: matches[0],
  sourcePage: serviceSource,
  layoutRevision: {
    id: "section-layout-revision",
    status: "ready",
    sanitizedArtifact: sectionLayout.artifact,
    semanticSlots: sectionLayout.semanticSlots,
    identityFingerprints: sectionLayout.identityFingerprints,
  },
  pagePlan: [servicePlan, contactPlan],
  matches,
  sourcePages: [serviceSource, contactSource],
  assets: [],
});
assert.equal(sectionPrepared.status, "ready");
assert.equal(sectionPrepared.artifact.length, 3);
const preservedSections = sectionPrepared.artifact.filter(
  (item) => (item as { elType?: string }).elType === "container",
);
assert.equal(preservedSections.length, 3);
assert.match(JSON.stringify(preservedSections[0]), /Emergency Dentistry/);
assert.match(JSON.stringify(preservedSections[1]), /Same-Day Help/);
assert.match(JSON.stringify(preservedSections[2]), /What to Expect/);
assert.equal(
  sectionPrepared.artifact.some(
    (item) => (item as { elType?: string }).elType === "e-flexbox",
  ),
  false,
);
assert.doesNotMatch(JSON.stringify(sectionPrepared.artifact), /Old hero|Old list|Old expectation/);
assert.doesNotMatch(JSON.stringify(sectionPrepared.artifact), /ENERGIZE_SLOT/);
assert.equal(
  sectionPrepared.notes.some((note) => /unsupported optional layout region/.test(note)),
  false,
);

const legacySectionTemplate = {
  ...template,
  content: [
    {
      id: "legacy-section",
      elType: "section",
      settings: { background_color: "#f5f5f5" },
      elements: [
        {
          id: "legacy-column",
          elType: "column",
          settings: { _column_size: 100 },
          elements: [
            { id: "legacy-title", elType: "widget", widgetType: "heading", settings: { title: "Old title", header_size: "h1" }, elements: [] },
            { id: "legacy-body", elType: "widget", widgetType: "text-editor", settings: { editor: "Old body" }, elements: [] },
          ],
        },
      ],
    },
  ],
};
const legacySectionText = JSON.stringify(legacySectionTemplate);
const legacySectionLayout = sanitizeLayoutTemplate({
  analysis: analyzeTemplateJson({
    fileName: "Legacy-Section-Service.json",
    sizeBytes: legacySectionText.length,
    checksum: createHash("sha256").update(legacySectionText).digest("hex"),
    document: legacySectionTemplate,
  }),
  document: legacySectionTemplate,
  fileName: "Legacy-Section-Service.json",
});
assert.equal(legacySectionLayout.status, "ready");
const legacySectionPrepared = preparePageDraft({
  page: servicePlan,
  match: matches[0],
  sourcePage: serviceSource,
  layoutRevision: {
    id: "legacy-section-layout-revision",
    status: "ready",
    sanitizedArtifact: legacySectionLayout.artifact,
    semanticSlots: legacySectionLayout.semanticSlots,
    identityFingerprints: legacySectionLayout.identityFingerprints,
  },
  pagePlan: [servicePlan, contactPlan],
  matches,
  sourcePages: [serviceSource, contactSource],
  assets: [],
});
const legacySectionRoot = legacySectionPrepared.artifact[0] as {
  elType: string;
  settings: Record<string, unknown>;
  elements: Array<{ elType: string; elements: Array<{ elType: string }> }>;
};
assert.equal(legacySectionRoot.elType, "section");
assert.equal(legacySectionRoot.settings.background_color, "#FFFFFF");
assert.equal(legacySectionRoot.elements[0].elType, "column");
assert.ok(
  legacySectionRoot.elements[0].elements.some(
    (element) => element.elType === "container",
  ),
);

assert.throws(
  () =>
    preparePageDraft({
      page: servicePlan,
      match: matches[0],
      sourcePage: serviceSource,
      layoutRevision: {
        id: "old-layout-revision",
        status: "ready",
        sanitizerVersion: "1",
        sanitizedArtifact: sanitized.artifact,
        semanticSlots: sanitized.semanticSlots,
        identityFingerprints: sanitized.identityFingerprints,
      },
      pagePlan: [servicePlan, contactPlan],
      matches,
      sourcePages: [serviceSource, contactSource],
      assets: [],
    }),
  /Add the original JSON to Template Library again/,
);

console.log("prepared draft checks passed");
