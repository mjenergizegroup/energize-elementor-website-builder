import type {
  LayoutPreviewDocument,
  LayoutPreviewRegion,
  LayoutPreviewSlotKind,
  LayoutSemanticSlot,
  LayoutThumbnail,
} from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function elements(node: JsonRecord): JsonRecord[] {
  return Array.isArray(node.elements) ? node.elements.filter(isRecord) : [];
}

function collectNodeIds(node: JsonRecord, ids = new Set<string>()): Set<string> {
  if (typeof node.id === "string") ids.add(node.id);
  for (const child of elements(node)) collectNodeIds(child, ids);
  return ids;
}

function previewKind(kind: LayoutSemanticSlot["kind"]): LayoutPreviewSlotKind | null {
  if (kind === "heading" || kind === "image") return kind;
  if (kind === "body" || kind === "list") return "body";
  if (kind === "button-label") return "button";
  return null;
}

function regionFromNodeIds(
  nodeIds: Set<string>,
  slots: LayoutSemanticSlot[],
): LayoutPreviewRegion {
  return {
    slots: slots
      .filter((slot) => nodeIds.has(slot.nodeId))
      .sort((left, right) => left.order - right.order)
      .map((slot) => previewKind(slot.kind))
      .filter((kind): kind is LayoutPreviewSlotKind => Boolean(kind)),
  };
}

function parseSlots(value: unknown): LayoutSemanticSlot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((slot): slot is LayoutSemanticSlot => {
    if (!isRecord(slot)) return false;
    return (
      typeof slot.nodeId === "string" &&
      typeof slot.kind === "string" &&
      typeof slot.order === "number"
    );
  });
}

export function previewFromThumbnail(
  thumbnail: LayoutThumbnail,
): LayoutPreviewDocument {
  const sections = Math.max(1, Math.min(8, thumbnail.sectionCount || 1));
  const remaining = {
    heading: thumbnail.headingSlots,
    body: thumbnail.bodySlots,
    image: thumbnail.imageSlots,
    button: thumbnail.buttonSlots,
  };

  return {
    sections: Array.from({ length: sections }, (_, sectionIndex) => {
      const regionCount = sectionIndex === 0 && remaining.image > 0 ? 2 : 1;
      const regions = Array.from({ length: regionCount }, (_, regionIndex) => {
        const slots: LayoutPreviewSlotKind[] = [];
        if (remaining.image > 0 && (regionIndex === 1 || sectionIndex > 0)) {
          slots.push("image");
          remaining.image -= 1;
        }
        if (remaining.heading > 0) {
          slots.push("heading");
          remaining.heading -= 1;
        }
        if (remaining.body > 0) {
          slots.push("body");
          remaining.body -= 1;
        }
        if (remaining.button > 0 && regionIndex === 0) {
          slots.push("button");
          remaining.button -= 1;
        }
        return { slots };
      });
      return { regions };
    }),
  };
}

export function buildLayoutPreview(input: {
  artifact: unknown;
  semanticSlots: unknown;
  fallback: LayoutThumbnail;
}): LayoutPreviewDocument {
  const artifact = isRecord(input.artifact) ? input.artifact : {};
  const topLevel = Array.isArray(artifact.content)
    ? artifact.content.filter(isRecord)
    : [];
  const slots = parseSlots(input.semanticSlots);
  if (topLevel.length === 0 || slots.length === 0) {
    return previewFromThumbnail(input.fallback);
  }

  return {
    sections: topLevel.slice(0, 12).map((section) => {
      const sectionChildren = elements(section);
      const containerChildren = sectionChildren.filter(
        (child) => child.elType === "container",
      );
      if (containerChildren.length === 0) {
        return { regions: [regionFromNodeIds(collectNodeIds(section), slots)] };
      }

      const regionNodeIds = containerChildren.slice(0, 4).map((child, index) => {
        const nodeIds = collectNodeIds(child);
        if (index === 0 && typeof section.id === "string") nodeIds.add(section.id);
        return nodeIds;
      });
      const directWidgetIds = new Set(
        sectionChildren
          .filter((child) => child.elType !== "container")
          .flatMap((child) => [...collectNodeIds(child)]),
      );
      if (regionNodeIds[0]) {
        for (const nodeId of directWidgetIds) regionNodeIds[0].add(nodeId);
      }
      return {
        regions: regionNodeIds.map((nodeIds) => regionFromNodeIds(nodeIds, slots)),
      };
    }),
  };
}
