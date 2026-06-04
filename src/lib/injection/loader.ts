import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ThemeMeta } from "./types";

// All theme assets live in /theme-templates/{theme}/ at the repo root and are
// read from disk at runtime. Adding a v2 theme is a matter of dropping a new
// folder here; no import statements change.
export const TEMPLATES_ROOT = join(process.cwd(), "theme-templates");

const THEME_KEY_RE = /^[a-z0-9-]+$/;

function safeThemeKey(theme: string): string {
  if (!THEME_KEY_RE.test(theme)) {
    throw new Error(`Invalid theme key: ${theme}`);
  }
  return theme;
}

export interface ElementorTemplate {
  content: unknown[];
  page_settings: unknown[];
  version: string;
  title: string;
  type: string;
}

export function loadThemeMeta(theme: string): ThemeMeta {
  const path = join(TEMPLATES_ROOT, safeThemeKey(theme), "_meta.json");
  if (!existsSync(path)) {
    throw new Error(`Unknown theme: ${theme} (no _meta.json found)`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ThemeMeta;
}

export function loadTemplate(theme: string, file: string): ElementorTemplate {
  // file comes from _meta (trusted), but guard against traversal anyway.
  if (file.includes("..") || file.includes("/")) {
    throw new Error(`Invalid template file: ${file}`);
  }
  const path = join(TEMPLATES_ROOT, safeThemeKey(theme), file);
  return JSON.parse(readFileSync(path, "utf8")) as ElementorTemplate;
}

// Every theme folder that contains a _meta.json. Pure filesystem discovery so
// new themes appear automatically.
export function discoverThemeKeys(): string[] {
  if (!existsSync(TEMPLATES_ROOT)) return [];
  return readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(TEMPLATES_ROOT, entry.name, "_meta.json")),
    )
    .map((entry) => entry.name)
    .sort();
}
