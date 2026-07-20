import assert from "node:assert/strict";
import { cleanAndClassifyPages, cleanMarkdown } from "./cleanup";
import { filterPages, selectFilteredPages } from "../firecrawl/filter";

const duplicateForm = `# Contact

Skip to main content

## Request an Appointment

Name
Email

## Services

Preventive care

## Request an Appointment

Name
Email

© 2026 Example Dental`;

const cleaned = cleanMarkdown(duplicateForm);
assert.equal(cleaned.removedNoiseLines, 2);
assert.equal(cleaned.removedDuplicateSections, 1);
assert.equal((cleaned.markdown.match(/Request an Appointment/g) ?? []).length, 1);

const footerNoise = cleanMarkdown(`Useful page copy.

[Open Accessibility Menu](https://www.energize-group.com/ "Open Accessibility Menu")

We use cookies to ensure you get the best experience on our website.

DenyAccept`);
assert.equal(footerNoise.markdown, "Useful page copy.");
assert.equal(footerNoise.removedNoiseLines, 3);

const staleFooterNoise = cleanMarkdown(`Useful page copy.

[Open Accessibility Menu](https://www.energize-group.com/ "Open Accessibility Menu")

We use cookies to ensure you get the best experience on our website.

[Learn more.](https://example.com/cookie-policy)

DenyAccept`);
assert.equal(staleFooterNoise.markdown, "Useful page copy.");
assert.equal(staleFooterNoise.removedNoiseLines, 4);

const leadingAccessibilityControl = cleanMarkdown(`Open Accessibility Menu

# Short Page

Useful content must remain.`);
assert.equal(
  leadingAccessibilityControl.markdown,
  "# Short Page\n\nUseful content must remain.",
);

const repeatedCallsToAction = cleanMarkdown(`# About Us

[(803) 555-0100](tel:8035550100) [Schedule Online](https://example.com/book)

## Our Story

Story copy.

[(803) 555-0100](tel:8035550100) [Schedule Online](https://example.com/book)

## Our Practice

Practice copy.

[(803) 555-0100](tel:8035550100) [Schedule Online](https://example.com/book)

## Visit Us

Visit copy.

[(803) 555-0100](tel:8035550100) [Schedule Online](https://example.com/book)`);
assert.equal(
  (repeatedCallsToAction.markdown.match(/Schedule Online/g) ?? []).length,
  2,
);
assert.match(repeatedCallsToAction.markdown, /# About Us/);
assert.match(repeatedCallsToAction.markdown, /## Visit Us/);

const result = cleanAndClassifyPages([
  {
    url: "https://example.com/",
    markdown: "# Example Dental\n\nWelcome to our practice.",
    metadata: { title: "Example Dental" },
  },
  {
    url: "https://example.com/blog/",
    markdown: "# News\n\nOur latest articles.",
    metadata: { title: "News" },
  },
  {
    url: "https://example.com/insights/healthy-smiles",
    markdown: "# Healthy Smiles\n\nArticle body.",
    metadata: { og: { type: "article" }, publishedTime: "2026-06-01" },
  },
  {
    url: "https://example.com/privacy-policy",
    markdown: "# Privacy Policy\n\nLegal text.",
    metadata: {},
  },
  {
    url: "https://example.com/welcome?utm_source=test",
    markdown: "# Example Dental\n\nWelcome to our practice.",
    metadata: {},
  },
]);

assert.equal(result.report.input, 5);
assert.equal(result.report.unique, 4);
assert.equal(result.report.duplicates, 1);
assert.equal(result.corePages.length, 1);
assert.equal(result.blogIndexes.length, 1);
assert.equal(result.blogPosts.length, 1);
assert.equal(result.skipped.length, 1);
assert.equal(result.blogPosts[0].classificationReason, "article metadata");
assert.equal(result.skipped[0].classificationReason, "policy page");
assert.equal(result.sourcePages.every((page) => page.id.length === 20), true);

const datedPost = cleanAndClassifyPages([
  {
    url: "https://example.com/healthy-habits",
    markdown: "# Healthy Habits\n\nDate: 2025-01-02\n\nPost body.",
    metadata: {},
  },
]);
assert.equal(datedPost.blogPosts.length, 1);
assert.equal(
  datedPost.blogPosts[0].classificationReason,
  "published date in source content",
);

const filtered = filterPages([
  {
    url: "https://example.com/",
    markdown: "# Homepage",
    metadata: { title: "Homepage" },
  },
  {
    url: "https://example.com/privacy-policy/",
    markdown: "# Privacy",
    metadata: { title: "Privacy" },
  },
]);
const selected = selectFilteredPages(filtered, [
  "https://example.com/privacy-policy/#details",
]);
assert.equal(selected.length, 1);
assert.equal(selected[0].title, "Privacy");

console.log("migration cleanup checks passed");
