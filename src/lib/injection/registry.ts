import { BaseThemeInjector } from "./base";
import {
  discoverThemeKeys,
  discoverThemePageFiles,
  loadThemeMeta,
} from "./loader";
import { ElevateInjector } from "./themes/elevate";
import { SummitInjector } from "./themes/summit";
import { LuxInjector } from "./themes/lux";
import type { ThemeInjector } from "./types";

// Central dispatcher. Themes that need bespoke behavior register a subclass
// here; everything else falls back to the data-driven BaseThemeInjector. Adding
// a v2 theme means: drop its folder in theme-templates/, optionally add a
// subclass, and add one line below. No existing code changes.
type InjectorCtor = new (
  meta: ReturnType<typeof loadThemeMeta>,
) => BaseThemeInjector;

const OVERRIDES: Record<string, InjectorCtor> = {
  elevate: ElevateInjector,
  summit: SummitInjector,
  lux: LuxInjector,
};

const cache = new Map<string, ThemeInjector>();

export function getInjector(theme: string): ThemeInjector {
  const cached = cache.get(theme);
  if (cached) return cached;

  const meta = loadThemeMeta(theme); // throws on unknown theme
  const Ctor = OVERRIDES[theme] ?? BaseThemeInjector;
  const injector = new Ctor(meta);
  cache.set(theme, injector);
  return injector;
}

export interface ThemeSummary {
  key: string;
  label: string;
  ready: boolean;
  status: string;
  pages: { key: string; label: string }[];
}

// Every visual preset is ready because V4 pages are generated from the shared
// Atomic foundation. The old template metadata remains available as reference
// for content coverage, but no longer controls deploy readiness.
export function listThemes(): ThemeSummary[] {
  return discoverThemeKeys().map((key) => {
    const meta = loadThemeMeta(key);
    const pageKeys =
      meta.pages.length > 0
        ? meta.pages.map(({ key }) => key)
        : discoverThemePageFiles(key);
    return {
      key,
      label: meta.label,
      ready: true,
      status: "atomic-ready",
      pages: pageKeys.map((page) => ({ key: page, label: titleCase(page) })),
    };
  });
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
