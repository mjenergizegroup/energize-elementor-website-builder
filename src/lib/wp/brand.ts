import type { BrandColors, BrandFonts } from "@/lib/types";

// Map our brand kit to the Elementor global kit payloads consumed by the
// mu-plugin /brand-colors and /brand-fonts endpoints.

export interface KitColor {
  _id: string;
  title: string;
  color: string;
}

export interface KitTypography {
  _id: string;
  title: string;
  typography_typography: "custom";
  typography_font_family: string;
  typography_font_weight?: string;
}

// Elementor's four system color slots are primary / secondary / text / accent.
export function toSystemColors(colors: BrandColors): KitColor[] {
  return [
    { _id: "primary", title: "Primary", color: colors.primary },
    { _id: "secondary", title: "Secondary", color: colors.secondary },
    { _id: "text", title: "Text", color: colors.text },
    { _id: "accent", title: "Accent", color: colors.accent },
  ];
}

const TINT_LEVELS = [80, 60, 40, 20] as const;
const TINT_COLOR_KEYS = ["primary", "secondary", "accent"] as const;
const BASE_CUSTOM_COLORS: KitColor[] = [
  { _id: "white", title: "White", color: "#FFFFFF" },
  { _id: "black", title: "Black", color: "#000000" },
];

export function toCustomColors(colors: BrandColors): KitColor[] {
  const highlight = colors.highlight;
  return [
    { _id: "background", title: "Background", color: colors.background },
    ...TINT_COLOR_KEYS.flatMap((key) =>
      TINT_LEVELS.map((level) => ({
        _id: `${key}_${level}`,
        title: `${titleCase(key)} ${level}`,
        color: tintTowardWhite(colors[key], level),
      })),
    ),
    ...(highlight
      ? [
          { _id: "highlight", title: "Highlight", color: highlight },
          ...TINT_LEVELS.map((level) => ({
            _id: `highlight_${level}`,
            title: `Highlight ${level}`,
            color: tintTowardWhite(highlight, level),
          })),
        ]
      : []),
    ...BASE_CUSTOM_COLORS,
  ];
}

function tintTowardWhite(hex: string, level: number): string {
  const { r, g, b } = parseHexColor(hex);
  const mix = (channel: number) =>
    Math.round(channel * (level / 100) + 255 * (1 - level / 100));

  return `#${[mix(r), mix(g), mix(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid brand color: ${hex}`);
  }

  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Heading font drives the primary + secondary typography slots; body font
// drives the text + accent slots.
export function toSystemTypography(fonts: BrandFonts): KitTypography[] {
  const heading = (id: string, title: string): KitTypography => ({
    _id: id,
    title,
    typography_typography: "custom",
    typography_font_family: fonts.heading,
    typography_font_weight: "600",
  });
  const body = (id: string, title: string): KitTypography => ({
    _id: id,
    title,
    typography_typography: "custom",
    typography_font_family: fonts.body,
    typography_font_weight: "400",
  });
  return [
    heading("primary", "Primary"),
    heading("secondary", "Secondary"),
    body("text", "Text"),
    body("accent", "Accent"),
  ];
}
