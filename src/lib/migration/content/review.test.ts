import assert from "node:assert/strict";
import {
  applyMigrationSourceUpdates,
  normalizeMigrationSourcePage,
  sourceContentSummary,
} from "./review";
import type { MigrationSourcePage } from "../types";

const page: MigrationSourcePage = {
  id: "page-1",
  sourceUrl: "https://example.com/about/",
  normalizedUrl: "https://example.com/about",
  title: "About",
  sourceChecksum: "raw-checksum",
  rawMarkdown: "# About\n\nRaw source.",
  cleanedMarkdown: "# About\n\nClean source.",
  approvedMarkdown: "# About\n\nClean source.",
  contentRevision: 1,
  classification: "core-page",
  classificationReason: "site content page",
  included: true,
  reviewed: false,
  metadata: {},
};

const approved = applyMigrationSourceUpdates(
  [page],
  [{ id: page.id, reviewed: true }],
  "2026-07-17T12:00:00.000Z",
);
assert.equal(approved[0].reviewed, true);
assert.equal(approved[0].approvedChecksum?.length, 64);
assert.equal(approved[0].approvedAt, "2026-07-17T12:00:00.000Z");

const edited = applyMigrationSourceUpdates(approved, [
  { id: page.id, approvedMarkdown: "# About\n\nReviewed copy." },
]);
assert.equal(edited[0].reviewed, false);
assert.equal(edited[0].approvedChecksum, undefined);
assert.equal(edited[0].contentRevision, 2);
assert.equal(edited[0].rawMarkdown, page.rawMarkdown);
assert.equal(edited[0].cleanedMarkdown, page.cleanedMarkdown);

const renamed = applyMigrationSourceUpdates(approved, [
  { id: page.id, title: "About Our Practice" },
]);
assert.equal(renamed[0].reviewed, false);
assert.equal(renamed[0].contentRevision, 2);

assert.throws(
  () =>
    applyMigrationSourceUpdates(edited, [
      { id: page.id, included: false, reviewed: true },
    ]),
  /must be included/,
);

const legacy = normalizeMigrationSourcePage({
  ...page,
  approvedMarkdown: undefined as unknown as string,
  contentRevision: undefined as unknown as number,
});
assert.equal(legacy.approvedMarkdown, page.cleanedMarkdown);
assert.equal(legacy.contentRevision, 1);

assert.deepEqual(sourceContentSummary(approved), {
  total: 1,
  included: 1,
  approved: 1,
  needsReview: 0,
  corePages: 1,
  blogPosts: 0,
});

console.log("migration source review checks passed");
