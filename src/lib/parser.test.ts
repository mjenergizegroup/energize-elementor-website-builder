/**
 * Edge case tests for the parser. Uses plain Node assertions so it can run
 * standalone (tsx parser.test.ts) or be adapted to Jest/Vitest by replacing
 * the assertion helper.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, ParseError, type ParseResult, type SectionData } from "./parser";

const __dirname = dirname(fileURLToPath(import.meta.url));

function section(result: ParseResult, page: string, sectionName: string): SectionData {
  const data = result.pages[page]?.[sectionName];
  assert.ok(data, `${page}.${sectionName} should exist`);
  return data;
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (e) {
    console.error(`FAIL: ${name}`);
    console.error(e);
    process.exit(1);
  }
}

// Test 1: Unknown placeholder warns but doesn't crash
test("unknown placeholder warns and leaves as-is", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## hero

### heading
Welcome to {city} and {unknown_value}
`;
  const r = parse(t);
  assert.equal(section(r, "homepage", "hero").heading, "Welcome to Summit and {unknown_value}");
  assert.ok(r.warnings.some((w) => w.includes("unknown_value")));
});

// Test 2: Empty field body
test("empty field body returns empty string", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## hero

### heading

### body
Some content
`;
  const r = parse(t);
  assert.equal(section(r, "homepage", "hero").heading, "");
  assert.equal(section(r, "homepage", "hero").body, "Some content");
});

// Test 3: Missing SITE block raises ParseError
test("missing SITE block raises ParseError", () => {
  const t = `# PAGE: homepage

## hero

### heading
Welcome
`;
  assert.throws(() => parse(t), ParseError);
});

// Test 4: Multi-paragraph body with markdown
test("markdown formatting preserved in prose body", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## intro

### body
This is paragraph **one** with bold.

This is paragraph two with a [link](https://example.com).
`;
  const r = parse(t);
  const body = section(r, "homepage", "intro").body as string;
  assert.ok(body.includes("**one**"));
  assert.ok(body.includes("[link]"));
});

// Test 5: List field
test("list field detected and parsed", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## hero

### trust_points
- Item one
- Item two
- Item three
`;
  const r = parse(t);
  assert.deepEqual(section(r, "homepage", "hero").trust_points, [
    "Item one",
    "Item two",
    "Item three",
  ]);
});

// Test 6: Repeating field with sub-fields (cards)
test("repeating fields with sub-fields parsed as list of dicts", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## services

### card
heading: A
body: Body of A

### card
heading: B
body: Body of B
`;
  const r = parse(t);
  const cards = section(r, "homepage", "services").card as Array<Record<string, string>>;
  assert.ok(Array.isArray(cards));
  assert.equal(cards.length, 2);
  assert.equal(cards[0].heading, "A");
  assert.equal(cards[1].heading, "B");
});

// Test 7: Single field with sub-fields (image)
test("scalar field with sub-fields parsed as dict", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## hero

### image
url: https://example.com/img.jpg
alt: A nice photo
`;
  const r = parse(t);
  const img = section(r, "homepage", "hero").image as Record<string, string>;
  assert.equal(typeof img, "object");
  assert.equal(img.url, "https://example.com/img.jpg");
  assert.equal(img.alt, "A nice photo");
});

// Test 8: Service pages separated
test("service pages separated and slugs extracted", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## hero

### heading
Home

# PAGE: service-page-implants

## hero

### heading
Implants

# PAGE: service-page-crowns

## hero

### heading
Crowns
`;
  const r = parse(t);
  assert.ok("homepage" in r.pages);
  assert.ok("implants" in r.service_pages);
  assert.ok("crowns" in r.service_pages);
  assert.ok(!("service-page-implants" in r.pages));
});

// Test 9: Values containing colons
test("values containing colons parsed correctly", () => {
  const t = `# SITE
city: Summit
booking_url: https://book.example.com/path?query=1
phone_tel: tel:555-1234

# PAGE: homepage

## hero

### image
url: https://example.com/img.jpg
alt: text with: colon inside
`;
  const r = parse(t);
  assert.equal(r.site.booking_url, "https://book.example.com/path?query=1");
  assert.equal(r.site.phone_tel, "tel:555-1234");
  const img = section(r, "homepage", "hero").image as Record<string, string>;
  assert.equal(img.url, "https://example.com/img.jpg");
  assert.equal(img.alt, "text with: colon inside");
});

// Test 10: MISSING markers preserved
test("MISSING markers preserved as-is", () => {
  const t = `# SITE
city: Summit

# PAGE: homepage

## promo_bar

### promo_2_eyebrow
[MISSING: client to confirm second promotional offer]
`;
  const r = parse(t);
  assert.equal(
    section(r, "homepage", "promo_bar").promo_2_eyebrow,
    "[MISSING: client to confirm second promotional offer]"
  );
});

// Regression test against the sample fixture
test("sample input matches sample output fixture", () => {
  const input = readFileSync(join(__dirname, "__fixtures__/sample-input.md"), "utf-8");
  const expected = JSON.parse(
    readFileSync(join(__dirname, "__fixtures__/sample-output.json"), "utf-8")
  );
  const result = parse(input);
  assert.deepEqual(
    {
      site: result.site,
      pages: result.pages,
      service_pages: result.service_pages,
      warnings: result.warnings,
    },
    expected
  );
});

console.log("\nAll tests passed.");
