import type { MigrationAsset } from "../types";
import type { TemplateContentMapping } from "./types";

export function remapContentMedia(
  mappings: TemplateContentMapping[],
  assets: MigrationAsset[],
): { mappings: TemplateContentMapping[]; blockers: string[] } {
  const assetsByUrl = new Map<string, MigrationAsset>();
  for (const asset of assets) {
    assetsByUrl.set(asset.sourceUrl, asset);
    assetsByUrl.set(asset.originalUrl, asset);
    if (asset.destinationUrl) assetsByUrl.set(asset.destinationUrl, asset);
  }
  const blockers: string[] = [];
  const output = mappings.map((mapping) => ({
    ...mapping,
    content: {
      ...mapping.content,
      slots: mapping.content.slots.map((slot) => {
        if (slot.kind !== "image") return slot;
        const asset = assetsByUrl.get(slot.sourceUrl);
        if (!asset?.destinationMediaId || !asset.destinationUrl) {
          blockers.push(
            `${mapping.content.title}: image ${slot.sourceUrl} must be migrated before page deployment.`,
          );
          return slot;
        }
        return {
          ...slot,
          sourceUrl: asset.destinationUrl,
          altText: asset.altText,
        };
      }),
    },
  }));
  return { mappings: output, blockers: [...new Set(blockers)] };
}
