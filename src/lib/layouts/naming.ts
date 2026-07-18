import {
  LAYOUT_CATEGORIES,
  type LayoutCategory,
} from "./types";

const GENERATED_LAYOUT_NAME = /^(home|about|service|contact|flexible)\s+layout\s+(\d+)$/i;

export function layoutCategoryLabel(category: LayoutCategory): string {
  return (
    LAYOUT_CATEGORIES.find((item) => item.value === category)?.label ?? category
  );
}

export function layoutDisplayName(layout: {
  friendlyName: string;
  category: LayoutCategory;
}): string {
  const match = layout.friendlyName.trim().match(GENERATED_LAYOUT_NAME);
  if (!match) return layout.friendlyName;
  return `${layoutCategoryLabel(layout.category)} Layout ${match[2]}`;
}

export function generatedLayoutNumber(name: string): number | undefined {
  const match = name.trim().match(GENERATED_LAYOUT_NAME);
  return match ? Number(match[2]) : undefined;
}

export function inferLayoutCategory(fileName: string): LayoutCategory {
  const name = fileName
    .replace(/\.json$/i, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  if (/\b(home|homepage|front page)\b/.test(name)) return "home";
  if (/\babout\b/.test(name)) return "about";
  if (/\bcontact\b/.test(name)) return "contact";
  if (/\b(service|services|treatment|treatments|procedure|procedures)\b/.test(name)) {
    return "service";
  }
  return "flexible";
}
