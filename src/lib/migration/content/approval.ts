import type { MigrationSourcePage } from "../types";
import type { TemplateContentMapping } from "./types";

export function validateCurrentApprovedContent(
  pages: MigrationSourcePage[],
  mappings: TemplateContentMapping[],
): string[] {
  const provenanceMappings = mappings.filter(
    (mapping) =>
      mapping.sourceRevision !== undefined || mapping.sourceChecksum !== undefined,
  );
  if (provenanceMappings.length === 0) return [];
  if (provenanceMappings.length !== mappings.length) {
    return ["The migration contains a mix of revisioned and legacy content mappings. Rebuild the template mapping before deployment."];
  }

  const pagesById = new Map(pages.map((page) => [page.id, page]));
  const errors: string[] = [];
  for (const mapping of mappings) {
    const page = pagesById.get(mapping.content.sourcePageId);
    if (!page) {
      errors.push(`${mapping.content.title}: the approved source page no longer exists.`);
      continue;
    }
    if (!page.included || !page.reviewed || !page.approvedChecksum) {
      errors.push(`${mapping.content.title}: the source page is not currently included and approved.`);
      continue;
    }
    if (
      mapping.sourceRevision !== page.contentRevision ||
      mapping.sourceChecksum !== page.approvedChecksum
    ) {
      errors.push(`${mapping.content.title}: the approved source revision changed. Rebuild the template mapping before deployment.`);
    }
  }
  return [...new Set(errors)];
}
