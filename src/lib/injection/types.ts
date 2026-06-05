// Shared types for the theme injection layer.

export type ThemeKey = string;
export type WpPageTemplate =
  | "default"
  | "elementor_header_footer"
  | "elementor_canvas";

// The value a parser supplies for a single slot.
// - string: heading, text-editor, button, blockquote, single icon-box field
// - object: icon-box with both title_text and description_text
// - string[]: icon-list items
export type SlotValue =
  | string
  | { title_text?: string; description_text?: string }
  | string[];

// One page worth of parsed content.
export interface PageContent {
  page: string; // page key, e.g. "homepage"
  wpTitle?: string; // WP page title (interior pages)
  slug?: string;
  wpPageTemplate?: WpPageTemplate;
  slots: Record<string, SlotValue>;
  // Notes the parser wants surfaced to David's team for this page.
  buildNotes?: string[];
}

// A full content document for a build (one practice, many pages).
export interface ParsedContent {
  practiceName: string;
  city?: string;
  doctorName?: string;
  pages: PageContent[];
}

// ---- _meta.json shapes ----

export interface SlotMeta {
  key: string;
  section?: string;
  label?: string;
  nodeId: string;
  widget: string;
  field?: string;
  fields?: string[];
  optional?: boolean;
  // Always inject this exact value (e.g. fixing a template typo).
  fixedValue?: string;
  // Informational: this node carries legacy markup that is always replaced.
  replaceLegacyHtml?: boolean;
}

export interface PageMeta {
  key: string;
  label: string;
  templateFile: string;
  wpPageTemplate?: WpPageTemplate;
  h1: "widget" | "wpTitle";
  doNotInject?: string[];
  generated?: boolean;
  notes?: string;
  slots: SlotMeta[];
}

export interface ThemeMeta {
  theme: string;
  label: string;
  themeVersion: string;
  defaultElementorVersion: string;
  templatePlaceholderNames?: string[];
  widgetLibrary?: string;
  status?: "ready" | "pending-port";
  notes?: string;
  pages: PageMeta[];
}

// ---- injection output ----

export interface InjectedPage {
  page: string; // page key
  title: string; // WP page title
  slug: string;
  wpPageTemplate: string;
  elementorVersion: string;
  // The Elementor content tree with all element IDs regenerated. Serialize
  // this to a JSON string for the _elementor_data meta key.
  elementorData: unknown[];
  buildNotes: string[]; // [DAVID: ...] / [MISSING: ...] flags
  warnings: string[]; // injection warnings (missing node, count mismatch)
}

export interface InjectContext {
  practiceName?: string;
  elementorVersion?: string;
}

export interface ThemeInjector {
  readonly theme: string;
  readonly meta: ThemeMeta;
  readonly ready: boolean;
  listPages(): PageMeta[];
  getPage(pageKey: string): PageMeta | undefined;
  injectPage(
    pageKey: string,
    content: PageContent,
    ctx?: InjectContext,
  ): InjectedPage;
}
