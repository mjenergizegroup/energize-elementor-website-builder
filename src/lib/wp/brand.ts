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
// Background has no system slot, so it goes to custom_colors.
export function toSystemColors(colors: BrandColors): KitColor[] {
  return [
    { _id: "primary", title: "Primary", color: colors.primary },
    { _id: "secondary", title: "Secondary", color: colors.secondary },
    { _id: "text", title: "Text", color: colors.text },
    { _id: "accent", title: "Accent", color: colors.accent },
  ];
}

export function toCustomColors(colors: BrandColors): KitColor[] {
  return [
    {
      _id: "background",
      title: "Background",
      color: colors.background,
    },
  ];
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
