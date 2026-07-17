import { button, flexbox, heading, image, legacyEmbed, paragraph } from "@/lib/elementor/atomic/elements";
import type { AtomicElement } from "@/lib/elementor/atomic/types";
import type { AtomicConversionResult, ConversionReviewItem, TemplateConversionAdapter } from "./types";

type JsonRecord = Record<string, unknown>;

export const elementorV3AtomicAdapter: TemplateConversionAdapter = {
  id: "elementor-v3-to-atomic",
  version: "1",
  supports(document) {
    return isRecord(document) && Array.isArray(document.content);
  },
  convert(document) {
    if (!isRecord(document) || !Array.isArray(document.content)) throw new Error("Elementor content tree is required.");
    const reviewItems: ConversionReviewItem[] = [];
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
        result = flexbox([], children, value.elType === "section" ? "section" : "div");
      } else if (value.elType === "widget") {
        const widget = String(value.widgetType ?? "");
        if (widget === "heading") {
          const level = normalizeHeading(settings.header_size);
          result = heading(String(settings.title ?? ""), level, []);
        } else if (widget === "text-editor") {
          result = paragraph(String(settings.editor ?? ""), []);
        } else if (widget === "button") {
          result = button(String(settings.text ?? ""), linkUrl(settings.link), []);
        } else if (widget === "image") {
          const source = isRecord(settings.image) ? settings.image : {};
          result = image(String(source.url ?? ""), String(settings.image_alt ?? settings.alt ?? ""), []);
        } else if (widget === "html" || widget === "shortcode" || widget === "google_maps") {
          result = legacyEmbed(widget, settings);
          reviewItems.push(review(widget === "shortcode" ? "shortcode" : "unsupported-widget", value, `${widget} is preserved as an explicit legacy embed.`));
        } else {
          reviewItems.push(review("unsupported-widget", value, `Widget ${widget || "unknown"} requires a conversion adapter.`));
        }
      }
      if (result) converted += 1;
      return result;
    };
    const elementorData = document.content.map(convertNode).filter((item): item is AtomicElement => Boolean(item));
    return { adapter: { id: this.id, version: this.version }, elementorData, converted, reviewItems, deployable: reviewItems.length === 0 } satisfies AtomicConversionResult;
  },
};

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
