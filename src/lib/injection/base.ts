import { findNode, regenerateElementIds, toHtml } from "./elementor";
import { loadTemplate } from "./loader";
import type {
  InjectContext,
  InjectedPage,
  PageContent,
  PageMeta,
  SlotMeta,
  SlotValue,
  ThemeInjector,
  ThemeMeta,
} from "./types";

export const DEFAULT_WP_PAGE_TEMPLATE = "elementor_header_footer";

// A fully data-driven injector. Every widget write is described by the slot
// entries in _meta.json (nodeId + field(s) + widget), so the same engine drives
// all themes. Theme-specific quirks are handled by subclassing and overriding
// injectPage (see themes/summit.ts when its hero mirror / accordions land).
export class BaseThemeInjector implements ThemeInjector {
  readonly theme: string;
  readonly meta: ThemeMeta;

  constructor(meta: ThemeMeta) {
    this.theme = meta.theme;
    this.meta = meta;
  }

  get ready(): boolean {
    return this.meta.status !== "pending-port" && this.meta.pages.length > 0;
  }

  listPages(): PageMeta[] {
    return this.meta.pages;
  }

  getPage(pageKey: string): PageMeta | undefined {
    return this.meta.pages.find((p) => p.key === pageKey);
  }

  injectPage(
    pageKey: string,
    content: PageContent,
    ctx?: InjectContext,
  ): InjectedPage {
    if (!this.ready) {
      throw new Error(
        `Theme "${this.theme}" is not ready for injection yet (status: ${this.meta.status ?? "unknown"}).`,
      );
    }
    const page = this.getPage(pageKey);
    if (!page) {
      throw new Error(`Theme "${this.theme}" has no page "${pageKey}".`);
    }

    const template = loadTemplate(this.theme, page.templateFile);
    const data = template.content;
    const warnings: string[] = [];

    for (const slot of page.slots) {
      this.injectSlot(data, slot, content, page, warnings);
    }

    // IDs are regenerated AFTER injection, since slots target original ids.
    regenerateElementIds(data);

    const buildNotes = [...(content.buildNotes ?? [])];
    if (page.generated) {
      buildNotes.push(
        `[NOTE: the ${page.label} template was generated for this build, not exported from the theme. Review the layout after import.]`,
      );
    }

    return {
      page: page.key,
      title: content.wpTitle ?? page.label,
      slug: content.slug ?? page.key,
      wpPageTemplate:
        content.wpPageTemplate ?? page.wpPageTemplate ?? DEFAULT_WP_PAGE_TEMPLATE,
      elementorVersion:
        ctx?.elementorVersion ?? this.meta.defaultElementorVersion,
      elementorData: data,
      buildNotes,
      warnings,
    };
  }

  protected injectSlot(
    data: unknown[],
    slot: SlotMeta,
    content: PageContent,
    page: PageMeta,
    warnings: string[],
  ): void {
    const raw: SlotValue | undefined =
      slot.fixedValue !== undefined ? slot.fixedValue : content.slots[slot.key];

    if (raw === undefined || raw === null || raw === "") {
      if (!slot.optional) {
        warnings.push(
          `[MISSING: ${page.key}.${slot.key} (${slot.label ?? slot.key})]`,
        );
      }
      return;
    }

    const node = findNode(data, slot.nodeId);
    if (!node) {
      warnings.push(
        `node ${slot.nodeId} (${slot.key}) not found in ${page.templateFile}`,
      );
      return;
    }
    const settings = (node.settings ??= {});

    // icon-list: write each item into settings.icon_list[i].text.
    if (slot.widget === "icon-list") {
      const items = Array.isArray(raw) ? raw : [];
      const existing = (settings.icon_list as { text?: string }[]) ?? [];
      if (items.length !== existing.length) {
        warnings.push(
          `icon-list ${slot.key} expects ${existing.length} items, got ${items.length}`,
        );
      }
      items.forEach((text, i) => {
        if (i < existing.length) existing[i].text = text;
      });
      return;
    }

    const fields = slot.fields ?? (slot.field ? [slot.field] : []);
    if (fields.length === 0) {
      warnings.push(`slot ${slot.key} has no field defined in _meta`);
      return;
    }

    const isEditorField = (f: string) => f === "editor";

    if (fields.length === 1) {
      const field = fields[0];
      let value: string | undefined;
      if (typeof raw === "string") {
        value = raw;
      } else if (Array.isArray(raw)) {
        warnings.push(`slot ${slot.key} expected text but received a list`);
        return;
      } else if (raw && typeof raw === "object") {
        value = raw[field as "title_text" | "description_text"];
      }
      if (value === undefined) {
        warnings.push(`slot ${slot.key} produced no value for field ${field}`);
        return;
      }
      settings[field] = isEditorField(field) ? toHtml(value) : value;
      return;
    }

    // Multiple fields (icon-box with title_text + description_text).
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const field of fields) {
        const value = raw[field as "title_text" | "description_text"];
        if (typeof value === "string") {
          settings[field] = isEditorField(field) ? toHtml(value) : value;
        }
      }
    } else if (typeof raw === "string") {
      // A bare string fills the first field (typically the title).
      settings[fields[0]] = raw;
    } else {
      warnings.push(
        `slot ${slot.key} expected an object with ${fields.join(" / ")}`,
      );
    }
  }
}
