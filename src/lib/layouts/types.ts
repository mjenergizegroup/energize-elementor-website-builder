export const LAYOUT_CATEGORIES = [
  { value: "home", label: "Home" },
  { value: "about", label: "About" },
  { value: "service", label: "Service" },
  { value: "contact", label: "Contact" },
  { value: "flexible", label: "Flexible" },
] as const;

export type LayoutCategory = (typeof LAYOUT_CATEGORIES)[number]["value"];
export type LayoutStatus = "ready" | "needs_setup" | "retired";
export type LayoutSlotKind =
  | "heading"
  | "body"
  | "button-label"
  | "link"
  | "image"
  | "list";

export interface LayoutSemanticSlot {
  id: string;
  kind: LayoutSlotKind;
  nodeId: string;
  settingKey: string;
  order: number;
  repeatable: boolean;
}

export interface LayoutIdentityFingerprint {
  kind: "content" | "domain" | "email" | "filename" | "id" | "phone" | "url";
  digest: string;
  length: number;
}

export interface LayoutThumbnail {
  sectionCount: number;
  headingSlots: number;
  bodySlots: number;
  imageSlots: number;
  buttonSlots: number;
}

export interface LayoutSanitationReport {
  sourceNodes: number;
  sanitizedNodes: number;
  regeneratedIds: number;
  settingsRemoved: number;
  contentValuesRemoved: number;
  sourceLinksRemoved: number;
  sourceMediaRemoved: number;
  globalsRemoved: number;
  dynamicBindingsRemoved: number;
  customCodeRemoved: number;
  unsupportedWidgetsRemoved: string[];
  blockingReasons: string[];
  residueMatches: string[];
}

export interface SanitizedLayoutResult {
  status: Exclude<LayoutStatus, "retired">;
  artifact: Record<string, unknown>;
  semanticSlots: LayoutSemanticSlot[];
  identityFingerprints: LayoutIdentityFingerprint[];
  report: LayoutSanitationReport;
  thumbnail: LayoutThumbnail;
  structuralSummary: string;
}

export interface LayoutLibraryItem {
  id: string;
  friendlyName: string;
  category: LayoutCategory;
  status: LayoutStatus;
  activeRevisionId: string | null;
  thumbnail: LayoutThumbnail;
  structuralSummary: string;
  revisionVersion: number | null;
  createdAt: string;
  updatedAt: string;
}
