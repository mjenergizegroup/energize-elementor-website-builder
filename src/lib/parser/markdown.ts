// Small markdown utilities shared by the theme parsers.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Strip a trailing " *(annotation)*" or " (annotation)" from a heading.
export function stripAnnotation(heading: string): string {
  return heading
    .replace(/\s*\*\(.*?\)\*\s*$/, "")
    .replace(/\s*\((?:[^()]*)\)\s*$/, "")
    .trim();
}

export interface MarkdownPage {
  heading: string; // raw H1 text (without leading #)
  lines: string[];
}

// Split a document into pages by single-# H1 headings.
export function splitPages(markdown: string): MarkdownPage[] {
  const lines = markdown.split(/\r?\n/);
  const pages: MarkdownPage[] = [];
  let current: MarkdownPage | null = null;
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h1) {
      current = { heading: h1[1], lines: [] };
      pages.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return pages;
}

export interface MarkdownSection {
  heading: string; // raw H2 text (annotation stripped)
  rawHeading: string;
  lines: string[];
}

// Split a page's lines into sections by ## H2 headings.
export function splitSections(lines: string[]): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | null = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = {
        rawHeading: h2[1],
        heading: stripAnnotation(h2[1]),
        lines: [],
      };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

// Extract `**Label:** value` pairs from a block of lines. A value runs until the
// next labeled line, a bold header without a colon (e.g. **Card 1**), a
// blockquote/flag, a rule, or a heading. Italic notes and flag lines are
// excluded from values.
export function extractLabeledSlots(
  lines: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  let currentLabel: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentLabel) {
      result[currentLabel] = buffer.join("\n").trim();
    }
    currentLabel = null;
    buffer = [];
  };

  for (const line of lines) {
    const labeled = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    const isBoldHeader = /^\*\*[^*]+\*\*\s*$/.test(line); // **Card 1** etc.
    const isHardBreak =
      /^>/.test(line) || /^---/.test(line) || /^#/.test(line) || isBoldHeader;
    const isItalicNote = /^\*\(.*\)\*\s*$/.test(line.trim());

    if (labeled) {
      flush();
      currentLabel = normalize(labeled[1]);
      if (labeled[2].trim()) buffer.push(labeled[2]);
    } else if (isHardBreak) {
      flush();
    } else if (isItalicNote) {
      // skip
    } else if (currentLabel !== null) {
      buffer.push(line);
    }
  }
  flush();
  return result;
}

// Collect [FLAG: ...] notes from blockquote lines in a block.
export function extractFlags(lines: string[]): string[] {
  const flags: string[] = [];
  for (const line of lines) {
    const m = line.match(/^>\s*\[FLAG:\s*(.+?)\]\s*$/);
    if (m) flags.push(`[FLAG: ${m[1].trim()}]`);
  }
  return flags;
}

// Turn a captured value into clean HTML paragraphs (for text-editor slots).
export function toParagraphHtml(value: string): string {
  const paragraphs = value
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

// Collapse a value to a single line of plain text (for heading/button slots).
export function toPlainText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
