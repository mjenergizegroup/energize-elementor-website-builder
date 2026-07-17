import assert from "node:assert/strict";
import { validateCurrentApprovedContent } from "./approval";
import type { MigrationSourcePage } from "../types";
import type { TemplateContentMapping } from "./types";

const page: MigrationSourcePage = {
  id: "page-1",
  sourceUrl: "https://example.com/about",
  normalizedUrl: "https://example.com/about",
  title: "About",
  sourceChecksum: "raw",
  rawMarkdown: "# About",
  cleanedMarkdown: "# About",
  approvedMarkdown: "# Approved About",
  contentRevision: 4,
  approvedChecksum: "a".repeat(64),
  approvedAt: "2026-07-17T12:00:00.000Z",
  classification: "core-page",
  classificationReason: "site content page",
  included: true,
  reviewed: true,
  metadata: {},
};

const mapping: TemplateContentMapping = {
  analysisId: "about-template",
  sourceRevision: 4,
  sourceChecksum: "a".repeat(64),
  content: {
    schemaVersion: "1",
    sourcePageId: page.id,
    title: "About",
    slug: "about",
    slots: [{ id: "heading", kind: "heading", text: "About", level: 1 }],
  },
};

assert.deepEqual(validateCurrentApprovedContent([page], [mapping]), []);
assert.match(
  validateCurrentApprovedContent(
    [{ ...page, contentRevision: 5, approvedChecksum: "b".repeat(64) }],
    [mapping],
  )[0],
  /approved source revision changed/,
);
assert.match(
  validateCurrentApprovedContent([{ ...page, reviewed: false }], [mapping])[0],
  /not currently included and approved/,
);
assert.match(validateCurrentApprovedContent([], [mapping])[0], /no longer exists/);
assert.deepEqual(
  validateCurrentApprovedContent([page], [
    { ...mapping, sourceRevision: undefined, sourceChecksum: undefined },
  ]),
  [],
);
assert.match(
  validateCurrentApprovedContent([page], [
    mapping,
    { ...mapping, analysisId: "legacy", sourceRevision: undefined, sourceChecksum: undefined },
  ])[0],
  /mix of revisioned and legacy/,
);

console.log("migration content approval checks passed");
