export const TEMPLATE_PAGE_ROLES = [
  { value: "homepage", label: "Homepage" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
  { value: "first-visit", label: "First Visit" },
  { value: "membership", label: "Membership" },
  { value: "amenities", label: "Amenities" },
  { value: "technology", label: "Technology" },
  { value: "blog-archive", label: "Blog Archive" },
  { value: "blog-single", label: "Blog Single" },
  { value: "service-page", label: "Service Page" },
  { value: "custom", label: "Custom Page" },
] as const;

export type TemplatePageRole = (typeof TEMPLATE_PAGE_ROLES)[number]["value"];
export type TemplateAnalysisStatus = "ready" | "review" | "blocked";
export type TemplateWarningSeverity = "blocker" | "warning" | "info";

export interface TemplateWarning {
  code: string;
  severity: TemplateWarningSeverity;
  title: string;
  message: string;
  remediation: string;
}

export interface TemplateAnalysis {
  id: string;
  file: {
    name: string;
    sizeBytes: number;
    checksum: string;
  };
  status: TemplateAnalysisStatus;
  format: {
    family: "elementor-export" | "generic-json" | "invalid-json";
    label: string;
    exportVersion?: string;
    confidence: number;
    capabilities: string[];
  };
  suggestedPage: {
    role: TemplatePageRole;
    label: string;
    slug: string;
    confidence: number;
    reasons: string[];
  };
  structure: {
    rootElements: number;
    nodeCount: number;
    maxDepth: number;
    elementTypes: Record<string, number>;
    widgets: Record<string, number>;
    duplicateElementIds: string[];
    settingAssignments: number;
    emptySettingAssignments: number;
    topLevelKeys: string[];
  };
  dependencies: {
    plugins: string[];
    unsupportedWidgets: string[];
    shortcodes: string[];
    dynamicBindings: number;
    globalReferences: number;
    customGlobalIds: string[];
    nonEmptyUrlObjects: number;
    targetBoundMediaIds: number;
    externalHosts: string[];
    sensitiveFieldNames: string[];
  };
  warnings: TemplateWarning[];
}

export interface TemplateMappingSelection {
  analysisId: string;
  fileName: string;
  checksum: string;
  selected: boolean;
  role: TemplatePageRole;
  title: string;
  slug: string;
  status: TemplateAnalysisStatus;
}

export interface TemplateMappingManifest {
  schemaVersion: "1";
  createdAt: string;
  mappings: TemplateMappingSelection[];
}
