/**
 * Type definitions for the Elevate theme website-builder.
 *
 * The builder consumes parsed content (from src/lib/parser.ts)
 * and a loaded Elementor JSON template, then produces a modified
 * JSON ready to push to WordPress via /energize/v1/page.
 */

// -----------------------------------------------------------------------------
// Public API types
// -----------------------------------------------------------------------------

export type ElevatePageType =
  | "homepage"
  | "about"
  | "service-page"
  | "contact"
  | "amenities"
  | "first-visit"
  | "insurance-and-financing";

/**
 * A loaded Elementor page export.
 *
 * Shape: `{ content: [...], page_settings: {...}, version: "...", title: "...", type: "..." }`.
 * We do not strictly type the internals because the parser/builder treats it as
 * opaque structured data and only modifies known node IDs.
 */
export type ElementorJSON = {
  content: unknown[];
  page_settings?: unknown;
  [key: string]: unknown;
};

export type SiteData = Record<string, string>;

/**
 * Re-exported from the parser. A page's parsed structure is a dict of
 * sections, each a dict of fields.
 */
export type FieldValue =
  | string
  | string[]
  | Record<string, string>
  | Array<Record<string, string>>;

export type SectionData = Record<string, FieldValue>;
export type PageData = Record<string, SectionData>;

export interface BuildOptions {
  pageType: ElevatePageType;
  site: SiteData;
  pageData: PageData;
  /** The loaded Elementor template JSON. Will be deep-cloned before injection. */
  template: ElementorJSON;
  /** Required when pageType === 'service-page'. The URL slug, e.g. 'cosmetic-dentistry'. */
  slug?: string;
}

export interface BuildResult {
  json: ElementorJSON;
  /** Non-fatal issues collected during the build. Surface in UI for review. */
  warnings: string[];
  /** Notes for David's team about what to hide, swap, or check post-build. */
  buildNotes: string[];
}

export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildError";
  }
}

// -----------------------------------------------------------------------------
// Node map types (internal)
// -----------------------------------------------------------------------------

export type WidgetType =
  | "heading"
  | "text-editor"
  | "button"
  | "icon-box"
  | "icon-list"
  | "image"
  | "image-box"
  | "elementskit-heading"
  | "elementskit-accordion";

/**
 * Mapping from a schema field to a specific widget in the template.
 */
export type FieldTarget =
  | { kind: "heading"; id: string }
  | { kind: "text-editor"; id: string }
  | { kind: "button"; id: string; urlSource?: keyof SiteData | "auto" }
  | { kind: "icon-box-title"; id: string }
  | { kind: "icon-box-desc"; id: string }
  | { kind: "icon-box-both"; id: string; titleKey: string; descKey: string }
  | { kind: "icon-list"; id: string }
  | { kind: "image"; id: string; urlKey?: string; altKey?: string }
  | { kind: "image-box"; id: string; titleKey: string; descKey: string }
  | { kind: "elementskit-heading"; id: string };

/**
 * A repeating field's mapping is an ordered array of per-item field maps.
 * Each item is a dict of (sub-field name) to FieldTarget.
 */
export type RepeatingMap = Array<Record<string, FieldTarget>>;

export type SectionFieldMap = FieldTarget | RepeatingMap;

export type SectionMap = Record<string, SectionFieldMap>;

export type PageMap = Record<string, SectionMap>;
