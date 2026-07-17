import assert from "node:assert/strict";
import { buildMediaInventory, originalAssetUrl, seoFilename } from "./inventory";
import { assertPublicImageUrl, fetchRemoteImage, isPrivateAddress } from "./remote";
import { migrateMediaAssets } from "./migrate";
import type { MigrationSourcePage } from "../types";

async function main() {

const page: MigrationSourcePage = {
  id: "page-1",
  sourceUrl: "https://example.com/about",
  normalizedUrl: "https://example.com/about",
  title: "About",
  sourceChecksum: "checksum",
  rawMarkdown: "",
  cleanedMarkdown: [
    "![Smiling dental patient](https://cdn.sanity.io/images/a/b/photo.jpg?w=800&q=80)",
    "![Smiling dental patient](https://cdn.sanity.io/images/a/b/photo.jpg?w=400)",
    '<img src="/team.webp" alt="Our dental team">',
    "![Icon](https://example.com/icon-arrow.png)",
  ].join("\n"),
  classification: "core-page",
  classificationReason: "site content page",
  included: true,
  reviewed: false,
  metadata: {},
};

const inventory = buildMediaInventory([page]);
assert.equal(inventory.length, 2);
assert.equal(inventory[0].sourcePageIds.length, 1);
assert.equal(inventory.every((asset) => asset.status === "ready"), true);
assert.equal(originalAssetUrl("https://cdn.sanity.io/images/a/b/photo.jpg?w=800&q=70"), "https://cdn.sanity.io/images/a/b/photo.jpg");
assert.match(seoFilename("Smiling Dental Patient", inventory[0].originalUrl), /^smiling-dental-patient-[a-f0-9]{8}\.(jpg|webp)$/);

assert.equal(isPrivateAddress("127.0.0.1"), true);
assert.equal(isPrivateAddress("169.254.169.254"), true);
assert.equal(isPrivateAddress("10.2.3.4"), true);
assert.equal(isPrivateAddress("::1"), true);
assert.equal(isPrivateAddress("8.8.8.8"), false);
await assert.rejects(() => assertPublicImageUrl("http://localhost/image.jpg", async () => ["127.0.0.1"]), /private/);
await assert.rejects(() => assertPublicImageUrl("ftp://example.com/image.jpg", async () => ["8.8.8.8"]), /HTTP/);

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
const fetched = await fetchRemoteImage("https://images.example.com/photo.png", {
  resolver: async () => ["8.8.8.8"],
  fetchImpl: async () => new Response(png, {
    status: 200,
    headers: { "Content-Type": "image/png", "Content-Length": String(png.length) },
  }),
});
assert.equal(fetched.mimeType, "image/png");
assert.deepEqual(fetched.bytes, png);

let uploads = 0;
const migrated = await migrateMediaAssets(inventory, {
  upload: async (input) => {
    uploads += 1;
    assert.ok(input.altText);
    return { id: 100 + uploads, sourceUrl: `https://wp.example.com/${input.filename}`, reused: false };
  },
}, {
  fetchImage: async (url) => ({ bytes: png, mimeType: "image/png", finalUrl: url }),
});
assert.equal(uploads, 2);
assert.equal(migrated.every((asset) => asset.status === "uploaded"), true);
assert.equal(migrated.every((asset) => asset.attemptCount === 1), true);

await migrateMediaAssets(migrated, {
  upload: async () => {
    uploads += 1;
    throw new Error("already uploaded assets must be skipped");
  },
});
assert.equal(uploads, 2);

  console.log("migration media checks passed");
}

void main();
