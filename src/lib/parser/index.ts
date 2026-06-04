import type { ParsedContent } from "@/lib/injection/types";
import { parseElevate } from "./elevate";

// Converts approved dental-content-writer markdown into the ParsedContent
// payload the injectors consume. One parser per theme, keyed to that theme's
// markdown section structure.

export interface ParseInput {
  theme: string;
  markdown: string;
  // Optional hint; parsers read every page present in the markdown.
  pages?: string[];
}

export class ParserNotImplementedError extends Error {
  constructor(theme: string) {
    super(
      `The ${theme} markdown parser is not implemented yet. It is blocked on the exact dental-content-writer markdown structure. Add that skill (or a sample .md) to /reference-skills/ and implement src/lib/parser/${theme}.ts.`,
    );
    this.name = "ParserNotImplementedError";
  }
}

export function parseContent(input: ParseInput): ParsedContent {
  switch (input.theme) {
    case "elevate":
      return parseElevate(input.markdown);
    case "summit":
      throw new ParserNotImplementedError("summit");
    case "lux":
      throw new ParserNotImplementedError("lux");
    default:
      throw new Error(`No parser registered for theme "${input.theme}".`);
  }
}
