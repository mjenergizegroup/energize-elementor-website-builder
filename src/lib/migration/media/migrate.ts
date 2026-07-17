import "server-only";
import { createHash } from "node:crypto";
import type { MigrationAsset } from "../types";
import { fetchRemoteImage, type RemoteImage } from "./remote";

export interface MediaUploadGateway {
  upload(input: {
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
    title: string;
    altText: string;
  }): Promise<{ id: number; sourceUrl: string; reused: boolean }>;
}

export async function migrateMediaAssets(
  assets: MigrationAsset[],
  gateway: MediaUploadGateway,
  options: {
    dryRun?: boolean;
    fetchImage?: (url: string) => Promise<RemoteImage>;
  } = {},
): Promise<MigrationAsset[]> {
  const fetchImage = options.fetchImage ?? fetchRemoteImage;
  const output: MigrationAsset[] = [];

  for (const asset of assets) {
    if (!asset.included || asset.status === "skipped" || asset.status === "uploaded") {
      output.push(asset);
      continue;
    }
    if (!asset.altText.trim()) {
      output.push({ ...asset, status: "review", error: "Alt text review is required." });
      continue;
    }
    if (options.dryRun) {
      output.push({ ...asset, status: "ready", error: undefined });
      continue;
    }
    try {
      const remote = await fetchImage(asset.originalUrl);
      const uploaded = await gateway.upload({
        filename: asset.filename,
        mimeType: remote.mimeType,
        bytes: remote.bytes,
        title: asset.title,
        altText: asset.altText,
      });
      output.push({
        ...asset,
        status: "uploaded",
        mimeType: remote.mimeType,
        checksum: createHash("sha256").update(remote.bytes).digest("hex"),
        attemptCount: asset.attemptCount + 1,
        destinationMediaId: uploaded.id,
        destinationUrl: uploaded.sourceUrl,
        error: undefined,
      });
    } catch (error) {
      output.push({
        ...asset,
        status: "failed",
        attemptCount: asset.attemptCount + 1,
        error: error instanceof Error ? error.message : "Media migration failed.",
      });
    }
  }
  return output;
}
