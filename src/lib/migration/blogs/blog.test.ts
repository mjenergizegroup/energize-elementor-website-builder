import assert from "node:assert/strict";
import {
  buildBlogDrafts,
  markdownToGutenberg,
  parseFrontMatter,
  promoteStandaloneBoldHeadings,
} from "./convert";
import { migrateBlogDrafts } from "./migrate";
import type { MigrationAsset, MigrationSourcePage } from "../types";

const imageUrl = "https://cdn.example.com/healthy-smile.jpg";
const destinationImageUrl = "https://wp.example.com/healthy-smile.jpg";
const blogMarkdown = [
  "---",
  'title: "Healthy Habits"',
  "date: 2025-03-04",
  "slug: better-healthy-habits",
  `featured_image: ${imageUrl}`,
  "excerpt: A practical guide.",
  "---",
  "# Healthy Habits",
  "",
  "**Daily care**",
  "",
  "Brush **twice** every day.",
  "",
  `![A healthy smile](${imageUrl})`,
].join("\n");

const page: MigrationSourcePage = {
  id: "post-1",
  sourceUrl: "https://example.com/insights/healthy-habits",
  normalizedUrl: "https://example.com/insights/healthy-habits",
  title: "Fallback title",
  sourceChecksum: "checksum",
  rawMarkdown: "",
  cleanedMarkdown: blogMarkdown.replaceAll("Healthy Habits", "Unapproved Draft"),
  approvedMarkdown: blogMarkdown,
  contentRevision: 1,
  classification: "blog-post",
  classificationReason: "article metadata",
  included: true,
  reviewed: true,
  metadata: {},
};

const asset: MigrationAsset = {
  id: "asset-1",
  sourceUrl: imageUrl,
  originalUrl: imageUrl,
  sourcePageIds: [page.id],
  status: "uploaded",
  included: true,
  discoveredAltText: "A healthy smile",
  altText: "Patient with a healthy smile",
  title: "Healthy smile",
  filename: "healthy-smile-12345678.jpg",
  mimeType: "image/jpeg",
  attemptCount: 1,
  destinationMediaId: 42,
  destinationUrl: destinationImageUrl,
};

async function main() {
  const frontMatter = parseFrontMatter(blogMarkdown);
  assert.equal(frontMatter.values.title, "Healthy Habits");
  assert.match(frontMatter.body, /^# Healthy Habits/);
  assert.match(
    promoteStandaloneBoldHeadings("**Daily care**\n\n**A sentence.**"),
    /^## Daily care\n\n\*\*A sentence\.\*\*$/,
  );

  const drafts = buildBlogDrafts([page], [asset]);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, "Healthy Habits");
  assert.equal(drafts[0].slug, "better-healthy-habits");
  assert.equal(drafts[0].date, "2025-03-04T00:00:00.000Z");
  assert.equal(drafts[0].featuredMediaId, 42);
  assert.deepEqual(drafts[0].unresolvedImageUrls, []);
  assert.equal(drafts[0].status, "ready");
  assert.match(drafts[0].gutenbergContent, /wp:heading/);
  assert.match(drafts[0].gutenbergContent, /<strong>twice<\/strong>/);
  assert.match(drafts[0].gutenbergContent, /"id":42/);
  assert.match(drafts[0].gutenbergContent, /Patient with a healthy smile/);
  assert.match(drafts[0].gutenbergContent, /wp-image-42/);

  const escaped = markdownToGutenberg(
    "Unsafe <script>alert(1)</script> [link](https://example.com/?a=1&b=2)",
  );
  assert.doesNotMatch(escaped, /<script>/);
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /<a href="https:\/\/example.com/);

  let writes = 0;
  const gateway = {
    upsertDraft: async () => {
      writes += 1;
      return {
        id: 101,
        status: "draft",
        url: "https://wp.example.com/?p=101",
        editUrl: "https://wp.example.com/wp-admin/post.php?post=101&action=edit",
        reused: false,
      };
    },
  };
  const dryRun = await migrateBlogDrafts(drafts, gateway, {
    dryRun: true,
    limit: 1,
  });
  assert.equal(writes, 0);
  assert.equal(dryRun.drafts[0].status, "ready");

  const secondDraft = {
    ...drafts[0],
    id: "blog-post-2",
    sourcePageId: "post-2",
    slug: "second-post",
  };
  const migrated = await migrateBlogDrafts(
    [drafts[0], secondDraft],
    gateway,
    { dryRun: false, limit: 1 },
  );
  assert.equal(writes, 1);
  assert.equal(migrated.migrated, 1);
  assert.equal(migrated.remaining, 1);
  assert.equal(migrated.drafts[0].status, "migrated");
  assert.equal(migrated.drafts[0].attemptCount, 1);
  assert.equal(migrated.drafts[1].status, "ready");

  await migrateBlogDrafts(migrated.drafts, gateway, {
    dryRun: false,
    limit: 1,
  });
  assert.equal(writes, 2, "a completed post must be skipped on retry");

  const unresolved = buildBlogDrafts([page], []);
  const blocked = await migrateBlogDrafts(unresolved, gateway, {
    dryRun: true,
    limit: 1,
  });
  assert.equal(blocked.failed, 1);
  assert.match(blocked.drafts[0].error ?? "", /must be migrated/);

  console.log("migration blog checks passed");
}

void main();
