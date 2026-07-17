import type { AtomicElement } from "@/lib/elementor/atomic/types";

export type NormalizedContentSlot =
  | { id: string; kind: "heading"; text: string; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { id: string; kind: "rich-text"; html: string }
  | { id: string; kind: "image"; sourceUrl: string; altText: string }
  | { id: string; kind: "link"; label: string; href: string };

export interface NormalizedPageContent {
  schemaVersion: "1";
  sourcePageId: string;
  title: string;
  slug: string;
  slots: NormalizedContentSlot[];
}

export interface ConversionReviewItem {
  id: string;
  code: "unsupported-widget" | "dynamic-binding" | "shortcode" | "invalid-node";
  sourceElementId?: string;
  widgetType?: string;
  message: string;
  source: unknown;
}

export interface AtomicConversionResult {
  adapter: { id: string; version: string };
  elementorData: AtomicElement[];
  converted: number;
  reviewItems: ConversionReviewItem[];
  deployable: boolean;
}

export interface TemplateConversionAdapter {
  readonly id: string;
  readonly version: string;
  supports(document: unknown): boolean;
  convert(document: unknown): AtomicConversionResult;
}
