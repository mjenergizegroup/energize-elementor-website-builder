# Elevate Theme Website-Builder - Spec (v1)

The Elevate website-builder takes parsed schema content (from the content parser) plus a loaded Elementor JSON template, and produces a modified JSON ready to push to WordPress via `/energize/v1/page`.

Module: `src/lib/builders/elevate/`
Templates: `theme-templates/elevate/*.json`

---

## Position in the pipeline

```
.md file -> parser -> ParseResult
                       │
                       ▼
              ┌────────────────────┐
              │  BUILDER (this)    │
              │  parsed + tmpl     │
              │   -> ElementorJSON │
              └────────────────────┘
                       │
                       ▼
              POST /wp-json/energize/v1/page
```

The builder is **pure**. Given the same inputs, it produces the same output. It does not load files, fetch URLs, generate IDs, or call out to anything. It deep-clones the template, mutates the clone, and returns it.

---

## Public API

```typescript
import { buildElevatePage } from "@/lib/builders/elevate";
import { parse } from "@/lib/parser";
import { readFileSync } from "node:fs";
import path from "node:path";

const parsed = parse(contentMarkdown);
const template = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "theme-templates/elevate/homepage.json"),
    "utf-8"
  )
);

const { json, warnings, buildNotes } = buildElevatePage({
  pageType: "homepage",
  site: parsed.site,
  pageData: parsed.pages.homepage,
  template,
});

// `json` is the Elementor JSON to POST to /energize/v1/page
// `warnings` are non-fatal issues to surface in the UI
// `buildNotes` are post-build instructions for David's team
```

For service pages, the `slug` is required:

```typescript
buildElevatePage({
  pageType: "service-page",
  slug: "cosmetic-dentistry",  // derives {service_name} = "Cosmetic Dentistry"
  site: parsed.site,
  pageData: parsed.service_pages["cosmetic-dentistry"],
  template: loadTemplate("service-page"),
});
```

The full orchestration loop for one practice:

```typescript
const parsed = parse(contentMarkdown);
const results = [];

for (const [pageName, pageData] of Object.entries(parsed.pages)) {
  const template = loadTemplate(pageName);
  results.push({
    page: pageName,
    ...buildElevatePage({ pageType: pageName as any, site: parsed.site, pageData, template }),
  });
}

for (const [slug, pageData] of Object.entries(parsed.service_pages)) {
  const template = loadTemplate("service-page");
  results.push({
    page: `service-page-${slug}`,
    ...buildElevatePage({
      pageType: "service-page",
      slug,
      site: parsed.site,
      pageData,
      template,
    }),
  });
}
```

---

## How it works

### 1. Deep-clone the template

The caller's template is never mutated. The builder uses `JSON.parse(JSON.stringify(template))` to clone before injection.

### 2. Walk the page map

Each page has a `PageMap` in `node-maps.ts` that defines, for every schema section and field, which widget IDs in the template should receive the content.

For example, the homepage's `hero.heading` maps to widget `#efa68b` (a heading widget). The builder finds that widget by ID, then calls the heading injector to set its `title` field.

### 3. Per-widget injection

Each widget type has a dedicated injector function (`injectors.ts`):

| Widget type | Sets | Notes |
|---|---|---|
| `heading` | `settings.title` | Plain text. `header_size` preserved. |
| `text-editor` | `settings.editor` | Wrapped in `<p>` tags. Markdown formatting passes through. |
| `button` | `settings.text` and (optionally) `settings.link.url` | URL resolved from `site` if `urlSource` configured. |
| `icon-box-title` | `settings.title_text` | Plain text. |
| `icon-box-desc` | `settings.description_text` | Plain text. |
| `icon-list` | `settings.icon_list[].text` | Preserves icons, truncates/pads list. |
| `image` | `settings.image.url` and `.alt` | Source set to "library". |
| `image-box` | `title_text`, `description_text`, `image.url`, `image.alt` | All in one widget. |
| `elementskit-heading` | `settings.ekit_heading_title` | Used for one section heading on About. |

### 4. Repeating items

When a schema field is repeating (e.g. `services.card` with 6 cards), the node map provides an ordered list of per-item field targets. The builder iterates through the items and applies each to the corresponding slot.

If the content has fewer items than the template has slots, the unused slots are flagged in `buildNotes` for David:

```
[DAVID: hide services.card slots 5-6 - only 4 provided]
```

If the content has more items than slots, the extras are dropped with a warning.

### 5. Optional sections

If a section is entirely omitted from the parsed content (e.g. no `membership_cta` because the practice has no membership), the builder skips it and adds a build note:

```
[DAVID: hide membership_cta section - not in content]
```

David's team hides those widgets in the Elementor editor before publishing. A future refinement could remove them programmatically.

### 6. Site-level auto-injections

Some widgets are populated from `site` directly without going through the schema:

- **Inner-page hero phone button** (About, Service Page, Contact): label = `site.phone`, link = `site.phone_tel`
- **Contact page practice-name heading**: `site.practice_name`
- **Contact page address icon-box**: composed from `site.address_line1`, `address_city`, `address_state`, `address_zip`
- **Contact page phone icon-box**: `site.phone`

These keep the schema clean (no need to re-author phone/address per page).

### 7. Button URL resolution

Buttons can declare `urlSource` in the node map:

```typescript
cta_label: { kind: "button", id: "1e12af9a", urlSource: "booking_url" }
```

The builder looks up `site[urlSource]` and writes it to the button's `settings.link.url`. Phone buttons use `urlSource: "phone_tel"`. Membership CTAs use `urlSource: "membership_url"`.

If `urlSource` is omitted, the template's existing link is preserved.

### 8. `{service_name}` substitution

The parser substitutes site placeholders (`{city}`, `{practice_name}`, etc.) but does not know about `{service_name}`. That is derived per service-page from the slug.

The builder converts the slug to title case (`cosmetic-dentistry` to `Cosmetic Dentistry`) and substitutes `{service_name}` in every string field of the service-page's data before injection.

---

## Build result

```typescript
interface BuildResult {
  json: ElementorJSON;       // the modified template, ready to POST
  warnings: string[];        // non-fatal issues (missing widgets, type mismatches)
  buildNotes: string[];      // instructions for David (hide section, hide slots)
}
```

The UI should:
- Show `buildNotes` to the team after every build so they know what to do post-import
- Show `warnings` only when non-empty. They indicate template/content mismatches that may need investigation
- Use `json` as the body of the POST to `/wp-json/energize/v1/page`

---

## Error handling

`BuildError` thrown for:
- Unknown `pageType`
- `service-page` without a `slug`

Everything else is a warning. The build always produces a JSON; the warnings tell you what didn't quite fit.

---

## What this version does NOT do

- **Doesn't handle FAQ accordion population.** The Elevate service-page template has two `elementskit-accordion` widgets that are empty. Populating them requires knowing the tab structure, which differs from a heading/text injection. For now, accordions stay empty; David populates manually.
- **Doesn't hide widgets programmatically.** When a section is omitted, the builder flags it for David; it doesn't actually remove the widgets from the JSON. Future work.
- **Doesn't manage container background images.** Some images on the templates (e.g. the doctor portrait on the homepage) are container backgrounds, not widgets. The schema's `image` field for those sections is ignored. David swaps backgrounds in the editor.
- **Doesn't validate the schema.** It assumes the parser produced reasonable data. Missing fields are silently skipped; type mismatches produce warnings; nothing throws on bad content (except `BuildError` for the two structural errors above).
- **Doesn't regenerate widget IDs.** Widget IDs in the output match the template. If WP-import requires fresh IDs per push, that's a separate post-processing step.
- **Doesn't handle theme variants.** Assumes the single Elevate template variant per page. If you have multiple Elevate variants (e.g. pediatric vs. general), each needs its own template + node map.

---

## Updating node maps

When a template's widget IDs change (David edits the template), the corresponding node map in `node-maps.ts` must be updated. The build will surface warnings for any node that can't be found, which makes drift easy to detect.

There's no auto-extraction tool yet. The maps were generated by inspecting the templates manually. A future improvement: a script that scans a template, prints widget IDs grouped by section, and generates a node-map skeleton.

---

## Testing

`elevate.test.ts` covers:
- Slug to service-name conversion
- Homepage build: hero, services cards, promo bar
- Service-page build with `{service_name}` derived from slug
- Service-page without slug throws
- Contact auto-injections (practice name, address, phone)
- Build notes for omitted sections
- Template not mutated (deep-clone correctness)
- `<p>` wrapping for text-editor
- MISSING markers preserved

Run:
```
npx tsx src/lib/builders/elevate/elevate.test.ts
```

Or wire into Vitest/Jest by replacing the assertion helper.

To regenerate the sample output fixtures:
```
npx tsx src/lib/builders/elevate/generate-sample-output.ts
```
