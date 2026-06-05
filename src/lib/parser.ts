/**
 * Energize Build Tool - Content Schema Parser
 *
 * Parses the Elevate Content Schema v1 markdown format into a structured
 * object the website-builder consumes.
 *
 * No external dependencies. Pure TypeScript.
 *
 * See: PARSER_SPEC.md, CONTENT_SCHEMA.md
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type FieldValue =
  | string
  | string[]
  | Record<string, string>
  | Array<Record<string, string>>;

export type SectionData = Record<string, FieldValue>;
export type PageData = Record<string, SectionData>;

export interface ParseResult {
  site: Record<string, string>;
  pages: Record<string, PageData>;
  service_pages: Record<string, PageData>;
  warnings: string[];
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

// -----------------------------------------------------------------------------
// Regex patterns
// -----------------------------------------------------------------------------

const RE_H1_SITE = /^#\s+SITE\s*$/;
const RE_H1_PAGE = /^#\s+PAGE:\s*(.+?)\s*$/;
const RE_H1_ANY = /^#\s+\S/;
const RE_H2 = /^##\s+(.+?)\s*$/;
const RE_H3 = /^###\s+(.+?)\s*$/;
const RE_KEY_VALUE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/;
const RE_LIST_ITEM = /^-\s+(.+)$/;
const RE_PLACEHOLDER = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function parse(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const blocks = splitIntoH1Blocks(lines);

  const result: ParseResult = {
    site: {},
    pages: {},
    service_pages: {},
    warnings: [],
  };

  let siteSeen = false;
  for (const [blockName, blockLines] of blocks) {
    if (blockName === "__SITE__") {
      if (siteSeen) {
        result.warnings.push("Multiple # SITE blocks found; using the last one.");
      }
      result.site = parseSiteBlock(blockLines);
      siteSeen = true;
    } else if (blockName.startsWith("PAGE:")) {
      const pageName = blockName.slice(5).trim();
      const pageDict = parsePageBlock(blockLines, pageName, result.warnings);
      if (pageName.startsWith("service-page-")) {
        const slug = pageName.slice("service-page-".length);
        if (slug in result.service_pages) {
          result.warnings.push(`Duplicate service-page slug '${slug}'; overwriting.`);
        }
        result.service_pages[slug] = pageDict;
      } else {
        if (pageName in result.pages) {
          result.warnings.push(`Duplicate page '${pageName}'; overwriting.`);
        }
        result.pages[pageName] = pageDict;
      }
    } else {
      result.warnings.push(`Ignored unknown top-level heading: ${blockName}`);
    }
  }

  if (!siteSeen) {
    throw new ParseError("No # SITE block found. Required at the top of the file.");
  }

  substitutePlaceholders(result);

  return result;
}

// -----------------------------------------------------------------------------
// Block splitting
// -----------------------------------------------------------------------------

function splitIntoH1Blocks(lines: string[]): Array<[string, string[]]> {
  const blocks: Array<[string, string[]]> = [];
  let currentName: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (RE_H1_SITE.test(line)) {
      if (currentName !== null) blocks.push([currentName, currentLines]);
      currentName = "__SITE__";
      currentLines = [];
    } else if (RE_H1_PAGE.test(line)) {
      const m = line.match(RE_H1_PAGE)!;
      if (currentName !== null) blocks.push([currentName, currentLines]);
      currentName = `PAGE:${m[1]}`;
      currentLines = [];
    } else if (RE_H1_ANY.test(line) && currentName !== null) {
      blocks.push([currentName, currentLines]);
      currentName = line.replace(/^#+\s+/, "").trim();
      currentLines = [];
    } else {
      if (currentName !== null) currentLines.push(line);
    }
  }

  if (currentName !== null) blocks.push([currentName, currentLines]);
  return blocks;
}

// -----------------------------------------------------------------------------
// SITE block parsing
// -----------------------------------------------------------------------------

function parseSiteBlock(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(RE_KEY_VALUE);
    if (m) {
      out[m[1].trim()] = m[2].trim();
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// PAGE block parsing
// -----------------------------------------------------------------------------

function parsePageBlock(lines: string[], pageName: string, warnings: string[]): PageData {
  const page: PageData = {};
  const sections = splitByHeading(lines, RE_H2);

  for (const [sectionName, sectionLines] of sections) {
    if (sectionName === null) {
      if (sectionLines.some((l) => l.trim())) {
        warnings.push(`Page '${pageName}': content before first ## section ignored.`);
      }
      continue;
    }
    page[sectionName] = parseSection(sectionLines, pageName, sectionName, warnings);
  }
  return page;
}

function parseSection(
  lines: string[],
  pageName: string,
  sectionName: string,
  warnings: string[]
): SectionData {
  const section: SectionData = {};
  const fieldBlocks = splitByHeading(lines, RE_H3);

  const occurrences: Record<string, string[][]> = {};
  const order: string[] = [];

  for (const [fieldName, fieldLines] of fieldBlocks) {
    if (fieldName === null) {
      if (fieldLines.some((l) => l.trim())) {
        warnings.push(`${pageName} / ${sectionName}: content before first ### field ignored.`);
      }
      continue;
    }
    if (!(fieldName in occurrences)) {
      occurrences[fieldName] = [];
      order.push(fieldName);
    }
    occurrences[fieldName].push(fieldLines);
  }

  for (const fieldName of order) {
    const bodies = occurrences[fieldName];
    if (bodies.length === 1) {
      section[fieldName] = parseFieldBody(bodies[0]);
    } else {
      // Repeating field. Each body is a parsed value; collect into array.
      const parsed = bodies.map((b) => parseFieldBody(b));
      // Cast: the schema convention is that repeating fields are dicts,
      // but we allow strings too if that's what the user wrote.
      section[fieldName] = parsed as FieldValue;
    }
  }
  return section;
}

// -----------------------------------------------------------------------------
// Field body parsing
// -----------------------------------------------------------------------------

function parseFieldBody(lines: string[]): string | string[] | Record<string, string> {
  // Strip leading/trailing blank lines
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start++;
  while (end > start && !lines[end - 1].trim()) end--;
  const trimmed = lines.slice(start, end);

  if (trimmed.length === 0) return "";

  const nonBlank = trimmed.filter((l) => l.trim());

  // Sub-field detection: all non-blank lines match key: value
  if (nonBlank.length > 0 && nonBlank.every((l) => RE_KEY_VALUE.test(l.trim()))) {
    const out: Record<string, string> = {};
    for (const l of nonBlank) {
      const m = l.trim().match(RE_KEY_VALUE);
      if (m) out[m[1].trim()] = m[2].trim();
    }
    return out;
  }

  // List detection: all non-blank lines start with `- `
  if (nonBlank.length > 0 && nonBlank.every((l) => RE_LIST_ITEM.test(l.trim()))) {
    return nonBlank.map((l) => l.trim().match(RE_LIST_ITEM)![1].trim());
  }

  // Otherwise: prose, paragraph structure preserved
  return trimmed.join("\n").trim();
}

// -----------------------------------------------------------------------------
// Generic heading splitter
// -----------------------------------------------------------------------------

function splitByHeading(
  lines: string[],
  pattern: RegExp
): Array<[string | null, string[]]> {
  const groups: Array<[string | null, string[]]> = [];
  let currentName: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const m = line.match(pattern);
    if (m) {
      groups.push([currentName, currentLines]);
      currentName = m[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  groups.push([currentName, currentLines]);
  return groups;
}

// -----------------------------------------------------------------------------
// Placeholder substitution
// -----------------------------------------------------------------------------

function substitutePlaceholders(result: ParseResult): void {
  const site = result.site;
  const warned = new Set<string>();

  function sub(value: unknown): unknown {
    if (typeof value === "string") {
      return value.replace(RE_PLACEHOLDER, (match, key: string) => {
        if (key in site) return site[key];
        if (!warned.has(key)) {
          result.warnings.push(`Unknown placeholder {${key}}; left as-is.`);
          warned.add(key);
        }
        return match;
      });
    }
    if (Array.isArray(value)) {
      return value.map(sub);
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = sub(v);
      }
      return out;
    }
    return value;
  }

  result.pages = sub(result.pages) as Record<string, PageData>;
  result.service_pages = sub(result.service_pages) as Record<string, PageData>;
}
