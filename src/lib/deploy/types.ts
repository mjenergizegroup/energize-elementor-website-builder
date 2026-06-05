import type { ParsedContent } from "@/lib/injection/types";
import type { ElevatePageType, PageData } from "@/lib/builders/elevate/types";
import type { BrandKit } from "@/lib/types";

export interface BuilderPageContent {
  page: string;
  wpTitle?: string;
  slug?: string;
  wpPageTemplate?: "default" | "elementor_header_footer" | "elementor_canvas";
  slots?: ParsedContent["pages"][number]["slots"];
  buildNotes?: string[];
  builderPageType?: ElevatePageType;
  serviceSlug?: string;
  pageData?: PageData;
}

export interface DeployContent {
  practiceName: string;
  city?: string;
  doctorName?: string;
  site?: Record<string, string>;
  pages: BuilderPageContent[];
}

export interface DeployRequest {
  theme: string;
  siteUrl: string;
  siteName: string;
  wpUsername: string;
  wpAppPassword: string;
  // content.pages is the source of truth for what gets built. It is already
  // filtered to the pages the user selected.
  content: DeployContent;
  brandKit: BrandKit;
  elementorVersion?: string;
}

export type DeployStep =
  | "page"
  | "site-identity"
  | "brand-colors"
  | "brand-fonts"
  | "logo"
  | "favicon"
  | "flush-css";

export type DeployEventType = "step" | "done" | "fatal";

export interface DeployEvent {
  type: DeployEventType;
  step?: DeployStep;
  status: "start" | "ok" | "fail";
  // Human label, e.g. "Creating homepage" / "Setting brand colors".
  label: string;
  message?: string;
  // For a finished page: the WP draft details.
  data?: {
    page?: string;
    title?: string;
    wpPageId?: number;
    editUrl?: string;
    viewUrl?: string;
  };
  // Accumulated build notes / warnings surfaced at the end.
  buildNotes?: string[];
  warnings?: string[];
}

export interface DeployedPageRecord {
  page: string;
  title: string;
  wpPageId: number;
  editUrl: string;
  viewUrl: string;
  status: "draft";
}
