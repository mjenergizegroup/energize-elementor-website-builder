// Shared, client-safe types (no server-only imports). Used by both the UI and
// server code.

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
  // Optional extra brand color. Only present when the build opted into it.
  highlight?: string;
}

export interface BrandFonts {
  heading: string;
  body: string;
}

export interface UploadedAsset {
  filename: string;
  // base64 (no data URI prefix needed; the bridge snippet strips it either way)
  dataBase64: string;
}

export interface BrandKit {
  colors: BrandColors;
  fonts: BrandFonts;
  logo?: UploadedAsset;
  favicon?: UploadedAsset;
}

export interface PracticeInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  doctors: { name: string; bio: string }[];
  services: string[];
  socialUrls: string[];
}

export interface WpTarget {
  siteUrl: string;
  username: string;
  appPassword: string;
}

// Page selected for a build, with its WP title and slug.
export interface PageSelection {
  page: string; // page key (homepage, about, ...)
  wpTitle: string;
  slug: string;
}
