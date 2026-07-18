import { createHash } from "node:crypto";
import type { LayoutIdentityFingerprint } from "./types";

export function scanPreparedLayoutResidue(
  artifact: unknown,
  fingerprints: LayoutIdentityFingerprint[],
  options: { checkPlaceholders?: boolean } = {},
): string[] {
  const strings = collectStrings(artifact);
  const matches = new Set<string>();
  const byLength = new Map<number, LayoutIdentityFingerprint[]>();
  for (const fingerprint of fingerprints) {
    if (fingerprint.length < 4 || fingerprint.length > 500) continue;
    const group = byLength.get(fingerprint.length) ?? [];
    group.push(fingerprint);
    byLength.set(fingerprint.length, group);
  }

  for (const value of strings) {
    const normalized = value.toLowerCase();
    if (
      options.checkPlaceholders !== false &&
      /\{\{ENERGIZE_(?:SLOT|BRAND):/.test(value)
    ) {
      matches.add("unfilled placeholder");
    }
    if (/__(?:globals|dynamic)__|custom_css|javascript|tracking|pixel/i.test(value)) {
      matches.add("unsafe template configuration");
    }
    for (const [length, candidates] of byLength) {
      if (normalized.length < length) continue;
      const digests = new Set(candidates.map((candidate) => candidate.digest));
      for (let index = 0; index <= normalized.length - length; index += 1) {
        const window = normalized.slice(index, index + length);
        const digest = createHash("sha256").update(window).digest("hex");
        if (digests.has(digest)) {
          for (const candidate of candidates.filter((item) => item.digest === digest)) {
            matches.add(`source ${candidate.kind}`);
          }
        }
      }
    }
  }
  return [...matches].sort();
}

function collectStrings(value: unknown, result: string[] = [], depth = 0): string[] {
  if (depth > 100) return result;
  if (typeof value === "string") {
    result.push(value);
    return result;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectStrings(child, result, depth + 1);
    return result;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      collectStrings(child, result, depth + 1);
    }
  }
  return result;
}
