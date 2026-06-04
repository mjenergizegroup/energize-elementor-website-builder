import { BaseThemeInjector } from "../base";

// Elevate is fully data-driven by theme-templates/elevate/_meta.json. Headings
// are plain text (no {{accent}} syntax), so the base engine needs no overrides.
export class ElevateInjector extends BaseThemeInjector {}
