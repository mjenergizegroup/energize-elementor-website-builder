import type { BrandColors } from "@/lib/types";

type ElementorNode = Record<string, unknown>;

const FOREGROUND_FIELDS = [
  "title_color",
  "text_color",
  "description_color",
  "icon_color",
  "primary_color",
  "secondary_color",
  "button_text_color",
] as const;

const BACKGROUND_FIELDS = [
  "background_color",
  "background_overlay_color",
  "background_overlay_color_b",
  "background_color_b",
] as const;

const BUTTON_COLOR_PAIRS = [
  ["background_color", "button_text_color"],
  ["button_background_hover_color", "hover_color"],
  ["st_one_normal_background_background_color", "st_one_normal_color_responsive"],
  ["st_one_hover_background_background_color", "st_one_hover_color_responsive"],
  ["st_two_normal_background_background_color", "st_two_normal_color_responsive"],
  ["st_two_hover_background_background_color", "st_two_hover_color_responsive"],
  ["st_middle_background_background_color", "st_middle_color_responsive"],
] as const;

interface ResolvedColor {
  hex?: string;
  token?: string;
  unresolvedGlobal?: boolean;
}

export function repairElementorTextContrast(
  node: unknown,
  colors: BrandColors,
): void {
  repairNodeTextContrast(node, colors, null);
}

function repairNodeTextContrast(
  node: unknown,
  colors: BrandColors,
  inheritedBackground: ResolvedColor | null,
): void {
  if (Array.isArray(node)) {
    node.forEach((child) => repairNodeTextContrast(child, colors, inheritedBackground));
    return;
  }
  if (!isObject(node)) return;

  const settings = isObject(node.settings) ? node.settings : null;
  const nodeBackground = settings
    ? resolveBackground(settings, colors) ?? inheritedBackground
    : inheritedBackground;

  if (settings) {
    const buttonBackground =
      isButtonNode(node) && resolveColor(settings, "background_color", colors);
    const textBackground = buttonBackground || nodeBackground;

    for (const field of FOREGROUND_FIELDS) {
      repairForeground(settings, field, textBackground, colors);
    }

    if (isButtonNode(node)) {
      repairButtonColors(settings, colors);
    }
  }

  const children = Array.isArray(node.elements)
    ? node.elements
    : Array.isArray(node.content)
      ? node.content
      : [];
  children.forEach((child) => repairNodeTextContrast(child, colors, nodeBackground));
}

function repairButtonColors(settings: ElementorNode, colors: BrandColors): void {
  for (const [backgroundField, foregroundField] of BUTTON_COLOR_PAIRS) {
    const background = resolveColor(settings, backgroundField, colors);
    if (!background?.hex) continue;

    const foreground = resolveColor(settings, foregroundField, colors);
    const needsRepair =
      !foreground?.hex ||
      foreground.unresolvedGlobal ||
      contrastRatio(foreground.hex, background.hex) < 4.5;

    if (needsRepair) {
      setDirectColor(settings, foregroundField, readableForeground(background.hex, colors));
    }
  }
}

function resolveBackground(
  settings: ElementorNode,
  colors: BrandColors,
): ResolvedColor | null {
  for (const field of BACKGROUND_FIELDS) {
    const color = resolveColor(settings, field, colors);
    if (color?.hex || color?.unresolvedGlobal) return color;
  }
  return null;
}

function repairForeground(
  settings: ElementorNode,
  field: string,
  background: ResolvedColor | null,
  colors: BrandColors,
): void {
  if (!background?.hex) return;

  const foreground = resolveColor(settings, field, colors);
  const hasExplicitField =
    settings[field] !== undefined ||
    (isObject(settings.__globals__) && settings.__globals__[field] !== undefined);

  if (!hasExplicitField) return;

  const needsRepair =
    !foreground?.hex ||
    foreground.unresolvedGlobal ||
    contrastRatio(foreground.hex, background.hex) < 4.5;

  if (!needsRepair) return;

  setDirectColor(settings, field, readableForeground(background.hex, colors));
}

function resolveColor(
  settings: ElementorNode,
  field: string,
  colors: BrandColors,
): ResolvedColor | null {
  const globalValue = isObject(settings.__globals__)
    ? settings.__globals__[field]
    : undefined;
  const fromGlobal = resolveColorValue(globalValue, colors);
  if (fromGlobal) return fromGlobal;

  return resolveColorValue(settings[field], colors);
}

function resolveColorValue(value: unknown, colors: BrandColors): ResolvedColor | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const globalMatch = value.match(/globals\/colors\?id=([^"&/]+)/);
  if (globalMatch) {
    const token = globalMatch[1];
    const hex = colorTokenToHex(token, colors);
    return hex ? { hex, token } : { token, unresolvedGlobal: true };
  }

  const hex = normalizeHexColor(value);
  if (hex) return { hex };

  const rgba = value.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i,
  );
  if (rgba) {
    return {
      hex: rgbToHex(
        Number.parseInt(rgba[1], 10),
        Number.parseInt(rgba[2], 10),
        Number.parseInt(rgba[3], 10),
      ),
    };
  }

  return null;
}

function colorTokenToHex(token: string, colors: BrandColors): string | null {
  if (token in colors) return colors[token as keyof BrandColors] ?? null;
  if (token === "white") return "#FFFFFF";
  if (token === "black") return "#111111";
  return null;
}

function normalizeHexColor(value: string): string | null {
  const match = value
    .trim()
    .match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  const raw = match[1];
  if (raw.length === 8) {
    const alpha = Number.parseInt(raw.slice(6, 8), 16) / 255;
    if (alpha < 0.2) return null;
  }
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw.slice(0, 6);
  return `#${expanded.toUpperCase()}`;
}

function setDirectColor(settings: ElementorNode, field: string, color: string): void {
  settings[field] = color;
  if (isObject(settings.__globals__)) {
    delete settings.__globals__[field];
  }
}

function readableForeground(background: string, colors: BrandColors): string {
  const candidates = [colors.text, colors.background, "#FFFFFF", "#111111"];
  return candidates.reduce((best, color) =>
    contrastRatio(color, background) > contrastRatio(best, background) ? color : best,
  );
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return { r: 0, g: 0, b: 0 };
  const value = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function isButtonNode(node: ElementorNode): boolean {
  return (
    node.elType === "widget" &&
    typeof node.widgetType === "string" &&
    node.widgetType.toLowerCase().includes("button")
  );
}

function isObject(value: unknown): value is ElementorNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
