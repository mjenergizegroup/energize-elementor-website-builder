import { button, flexbox, heading, image, legacyEmbed, paragraph } from "@/lib/elementor/atomic/elements";
import { CLASS_IDS } from "@/lib/elementor/atomic/foundation";
import type { AtomicElement } from "@/lib/elementor/atomic/types";
import type { AtomicConversionResult, ConversionReviewItem, TemplateConversionAdapter } from "./types";

type JsonRecord = Record<string, unknown>;

export const elementorV3AtomicAdapter: TemplateConversionAdapter = {
  id: "elementor-v3-to-atomic",
  version: "2",
  supports(document) {
    return isRecord(document) && Array.isArray(document.content);
  },
  convert(document) {
    if (!isRecord(document) || !Array.isArray(document.content)) throw new Error("Elementor content tree is required.");
    const reviewItems: ConversionReviewItem[] = [];
    const slotTargets: Record<string, string> = {};
    let converted = 0;
    const convertNode = (value: unknown): AtomicElement | null => {
      if (!isRecord(value) || typeof value.elType !== "string") {
        reviewItems.push(review("invalid-node", value, "A source node is not a recognized Elementor element."));
        return null;
      }
      const settings = isRecord(value.settings) ? value.settings : {};
      const children = Array.isArray(value.elements) ? value.elements.map(convertNode).filter((item): item is AtomicElement => Boolean(item)) : [];
      if (isRecord(settings.__dynamic__) && Object.keys(settings.__dynamic__).length > 0) {
        reviewItems.push(review("dynamic-binding", value, "Dynamic content requires destination mapping."));
      }
      let result: AtomicElement | null = null;
      if (value.elType === "section" || value.elType === "column" || value.elType === "container") {
        result = flexbox(
          value.elType === "section"
            ? [CLASS_IDS.section]
            : value.elType === "column"
              ? [CLASS_IDS.stack]
              : [CLASS_IDS.container, CLASS_IDS.stack],
          children,
          value.elType === "section" ? "section" : "div",
        );
      } else if (value.elType === "widget") {
        const widget = String(value.widgetType ?? "");
        if (widget === "heading") {
          const level = normalizeHeading(settings.header_size);
          result = heading(String(settings.title ?? ""), level, [headingClass(level)]);
        } else if (widget === "text-editor") {
          result = paragraph(String(settings.editor ?? ""), [CLASS_IDS.body]);
        } else if (widget === "button") {
          result = button(String(settings.text ?? ""), linkUrl(settings.link), [
            CLASS_IDS.button,
            CLASS_IDS.buttonPrimary,
          ]);
        } else if (widget === "image") {
          const source = isRecord(settings.image) ? settings.image : {};
          result = image(
            String(source.url ?? ""),
            String(settings.image_alt ?? settings.alt ?? ""),
            [CLASS_IDS.media],
          );
        } else if (widget === "icon-list") {
          result = paragraph(String(settings.icon_list ?? ""), [CLASS_IDS.body]);
        } else if (widget === "icon-box") {
          const boxChildren: AtomicElement[] = [];
          if (typeof settings.title === "string") {
            const title = heading(settings.title, "h3", [CLASS_IDS.h3]);
            registerSlotTargets(settings.title, title.id, slotTargets);
            boxChildren.push(title);
          }
          if (typeof settings.description === "string") {
            const description = paragraph(settings.description, [CLASS_IDS.body]);
            registerSlotTargets(settings.description, description.id, slotTargets);
            boxChildren.push(description);
          }
          result = boxChildren.length > 0
            ? flexbox([CLASS_IDS.stack], boxChildren)
            : null;
        } else if (widget === "icon") {
          result = null;
        } else if (widget === "html" || widget === "shortcode" || widget === "google_maps") {
          result = legacyEmbed(widget, settings);
          reviewItems.push(review(widget === "shortcode" ? "shortcode" : "unsupported-widget", value, `${widget} is preserved as an explicit legacy embed.`));
        } else {
          reviewItems.push(review("unsupported-widget", value, `Widget ${widget || "unknown"} requires a conversion adapter.`));
        }
      }
      if (result) {
        if (String(value.widgetType ?? "") !== "icon-box") {
          registerSlotTargets(settings, result.id, slotTargets);
        }
        converted += 1;
      }
      return result;
    };
    const elementorData = document.content.map(convertNode).filter((item): item is AtomicElement => Boolean(item));
    return { adapter: { id: this.id, version: this.version }, elementorData, slotTargets, converted, reviewItems, deployable: reviewItems.length === 0 } satisfies AtomicConversionResult;
  },
};

function registerSlotTargets(
  value: unknown,
  atomicId: string,
  targets: Record<string, string>,
) {
  const serialized = JSON.stringify(value);
  for (const match of serialized.matchAll(/\{\{ENERGIZE_SLOT:([^}]+)\}\}/g)) {
    targets[match[1]] = atomicId;
  }
}

function headingClass(level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): string {
  return CLASS_IDS[level];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeHeading(value: unknown): "h1" | "h2" | "h3" | "h4" | "h5" | "h6" {
  return typeof value === "string" && /^h[1-6]$/.test(value) ? value as "h1" | "h2" | "h3" | "h4" | "h5" | "h6" : "h2";
}

function linkUrl(value: unknown): string {
  return isRecord(value) && typeof value.url === "string" ? value.url : "#";
}

function review(code: ConversionReviewItem["code"], source: unknown, message: string): ConversionReviewItem {
  const record = isRecord(source) ? source : {};
  return { id: `${String(record.id ?? "node")}:${code}`, code, sourceElementId: typeof record.id === "string" ? record.id : undefined, widgetType: typeof record.widgetType === "string" ? record.widgetType : undefined, message, source };
}
