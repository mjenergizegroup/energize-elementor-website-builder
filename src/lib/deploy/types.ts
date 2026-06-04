import type { ParsedContent } from "@/lib/injection/types";
import type { BrandKit } from "@/lib/types";

export interface DeployRequest {
  theme: string;
  siteUrl: string;
  // content.pages is the source of truth for what gets built (already filtered
  // to the pages the user selected). It can contain several "services" pages.
  content: ParsedContent;
  brandKit: BrandKit;
  elementorVersion?: string;
}

export type DeployStep =
  | "page"
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
