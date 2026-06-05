# Content Schema Parser — Spec (v1)

This document specifies the parser the Energize Build Tool uses to convert the structured content markdown file (Elevate Content Schema v1) into the structured object the website-builder consumes.

The TypeScript implementation in `src/lib/content/parser.ts` is the canonical source of truth. A paired sample input (`__fixtures__/sample-input.md`) and expected output (`__fixtures__/sample-output.json`) lock the behavior with a regression test.

---

## Position in the pipeline

```
Firecrawl scrape → Claude.ai cleanup Project → structured .md file
                                                       │
                                                       ▼
                                          ┌────────────────────────┐
                                          │  PARSER (this spec)    │
                                          │  .md → ParseResult     │
                                          └────────────────────────┘
                                                       │
                                                       ▼
                              Website-builder → Elementor JSON files
                                                       │
                                                       ▼
                                        WP REST push via /energize/v1/page
```

The parser is the boundary between content authoring (free-form markdown) and content injection (structured data). It must be:

- **Deterministic.** Same input, same output. No LLM, no network calls, no time-dependent behavior.
- **Pure TypeScript.** Standard library only. No third-party markdown libs.
- **Strict about structure, forgiving about whitespace.** Headings and key/value lines must match the spec. Blank lines and trailing whitespace are normalized away.

---

## Input format

UTF-8 text file matching Elevate Content Schema v1. Three structural levels:

| Level | Marker | Purpose |
|---|---|---|
| 1 | `# SITE` | Site-wide values (one block per file, required) |
| 1 | `# PAGE: <name>` | Page delimiter (one block per page) |
| 2 | `## <section>` | Section within a page |
| 3 | `### <field>` | Named field within a section |

The full schema is documented in `CONTENT_SCHEMA.md`. The parser does not validate against the schema — it parses whatever structure is present and lets the website-builder detect missing required content.

---

## Output format

```typescript
export interface ParseResult {
  site: Record<string, string>;
  pages: Record<string, PageData>;            // keyed by page name
  service_pages: Record<string, PageData>;    // keyed by slug, `service-page-` prefix stripped
  warnings: string[];
}

export type SectionData = Record<string, FieldValue>;
export type PageData = Record<string, SectionData>;

export type FieldValue =
  | string                              // prose
  | string[]                            // list field (- items)
  | Record<string, string>              // sub-fields (key: value)
  | Array<Record<string, string>>;      // repeating field with sub-fields
```

See `__fixtures__/sample-input.md` paired with `__fixtures__/sample-output.json` for a complete worked example.

---

## Parsing rules

### Step 1 — Group by H1 blocks

Walk line by line. When a line matches `^# SITE\s*$` or `^# PAGE:\s*(.+)\s*$`, close the previous block and start a new one. Any other H1 (`^# .+`) is captured and adds a warning.

The first H1 must be `# SITE`. If no `# SITE` block is found anywhere, throw `ParseError`. A duplicate `# SITE` block warns and uses the last one.

### Step 2 — Parse the SITE block

Each non-blank, non-comment line matches `key: value`. The key matches `^[a-zA-Z_][a-zA-Z0-9_]*$`. Everything after the first `:` and surrounding whitespace is the value. Values may contain colons (URLs do: `https://example.com:8080/path`, `tel:555-1234`). Lines that don't match the pattern are silently skipped.

### Step 3 — Parse each PAGE block

Split by `## <section>` headings. Each section name is captured verbatim. Content before the first `##` is ignored (with a warning if non-empty).

### Step 4 — Parse each section

Split by `### <field>` headings. Repeated field names within the same section accumulate in order. Content before the first `###` is ignored (with a warning if non-empty).

### Step 5 — Parse each field body

The body is every line between the `### field` heading and the next `###`, `##`, or `#` heading. Leading and trailing blank lines stripped. Then:

1. If every non-blank line matches `key: value`, the body is parsed as a dict of sub-fields.
2. Else, if every non-blank line starts with `- `, the body is parsed as a list of strings.
3. Else, treated as prose. The full body (with internal blank lines preserved) is joined with `\n` and stripped at the boundaries. Markdown formatting (bold, italics, links, inline code) passes through verbatim.

An empty field body returns `""`.

### Step 6 — Resolve repeating vs scalar fields

- 1 occurrence → store the parsed body directly (scalar; may be a string, list, or dict).
- 2+ occurrences → store a list of parsed bodies in document order.

The parser does not need any schema knowledge — the file structure determines the shape. `### image` appearing once becomes `{ image: { url, alt } }`. `### card` appearing 6 times becomes `{ card: [{...}, {...}, ...] }`.

### Step 7 — Service page fan-out

After all blocks are parsed, partition pages:

- Page names starting with `service-page-` go into `service_pages`, keyed by slug (prefix stripped).
- All other pages go into `pages`, keyed by full name.

Duplicate page names warn and use the last occurrence.

### Step 8 — Placeholder substitution

After parsing, walk `pages` and `service_pages` recursively. In every string value, replace `{placeholder}` tokens with the matching value from `site`. Pattern: `/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g`.

Unknown placeholders are left as-is in the output and added to `warnings` (deduplicated). The `site` dict itself is not substituted into.

---

## Error handling

### Throws `ParseError`

- No `# SITE` block found.

### Warnings (collected in `result.warnings`)

- Duplicate `# SITE` block.
- Duplicate page name.
- Duplicate service-page slug.
- Unknown placeholder.
- Top-level H1 that is not `# SITE` or `# PAGE:`.
- Non-empty content before the first `##` in a page, or before the first `###` in a section.

The website-builder validates that required sections and fields are present. The parser only complains about structural problems that prevent parsing.

---

## What the parser does NOT do

- Does not validate against the schema (no required-section enforcement).
- Does not render markdown to HTML.
- Does not load Elementor templates or produce JSON output.
- Does not fetch images or validate URLs.
- Does not enforce house style (em-dash detection etc. is the cleanup Project's job).
- Does not write files.

---

## Integration

```typescript
import { parse, ParseError } from "@/lib/content/parser";

const text = await file.text();  // or readFileSync etc.

try {
  const result = parse(text);

  for (const w of result.warnings) {
    console.warn(`[parser] ${w}`);
    // surface in the build tool UI
  }

  await buildHomepage(result.site, result.pages.homepage);
  await buildAbout(result.site, result.pages.about);
  await buildContact(result.site, result.pages.contact);

  for (const [slug, pageData] of Object.entries(result.service_pages)) {
    await buildServicePage(result.site, slug, pageData);
  }
} catch (e) {
  if (e instanceof ParseError) {
    // surface to UI; halt the build
    return { error: e.message };
  }
  throw e;
}
```

The website-builder receives `site` (for placeholder values it needs to inject into widget IDs that don't pass through prose, like button URLs and image URLs) plus the page-specific data (which has already had `{placeholder}` substitution applied to all prose).

---

## Edge cases worth knowing

1. **URLs with query strings**: `booking_url: https://book.example.com/path?query=1` works. The first `:` splits key from value; everything after is the value.
2. **Phone with `tel:` prefix**: `phone_tel: tel:555-1234` works.
3. **Values with embedded colons**: `alt: text with: colon inside` works.
4. **`[MISSING: ...]` markers**: passed through as literal strings. The website-builder or UI decides what to do with them.
5. **Multi-paragraph prose**: paragraph breaks (`\n\n`) preserved in the output string.
6. **Markdown formatting in prose**: passed through verbatim.
7. **Empty fields**: `### heading` followed by no content returns `""`.
8. **Field that looks like sub-fields but is actually prose**: rule is "every non-blank line matches `key: value`." If any line is prose, the whole body is prose. Prevents accidental sub-field detection when a sentence contains "Note: something."
9. **Whitespace tolerance**: leading/trailing blank lines stripped, internal lines preserved.

---

## Test fixtures

Two files ship with the parser:

- `__fixtures__/sample-input.md` — covers SITE, multiple pages, repeating cards with sub-fields, list fields, FAQ items, service-page fan-out, placeholder substitution, MISSING markers.
- `__fixtures__/sample-output.json` — exact expected output of `parse(readFileSync('__fixtures__/sample-input.md', 'utf-8'))`.

`parser.test.ts` contains 10 edge case tests plus 1 regression test against the fixture pair. Run with:

```
npx tsx src/lib/content/parser.test.ts
```

or wire into the project's existing test runner (Vitest, Jest, etc).

Any change to `parser.ts` must keep the fixture regression test passing. If behavior intentionally changes, regenerate the fixture and update this spec.
