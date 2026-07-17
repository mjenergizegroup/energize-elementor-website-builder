import {
  type TemplateAnalysis,
  type TemplateAnalysisStatus,
  type TemplatePageRole,
  type TemplateWarning,
} from "./types";

type JsonRecord = Record<string, unknown>;

export interface AnalyzeTemplateInput {
  fileName: string;
  sizeBytes: number;
  checksum: string;
  document: unknown;
}

const STANDARD_WIDGETS = new Set([
  "button",
  "google_maps",
  "heading",
  "icon",
  "icon-box",
  "icon-list",
  "image",
  "shortcode",
  "text-editor",
]);

const ELEMENTOR_PRO_WIDGETS = new Set([
  "share-buttons",
  "theme-post-content",
  "theme-post-featured-image",
]);

const STANDARD_GLOBAL_IDS = new Set([
  "accent",
  "alternate",
  "background",
  "black",
  "h1",
  "h2",
  "h3",
  "primary",
  "secondary",
  "tertiary",
  "text",
  "white",
]);

const SERVICE_TERMS = [
  "aligner",
  "bridge",
  "clear aligner",
  "cosmetic dentistry",
  "crown",
  "denture",
  "emergency dentistry",
  "endodont",
  "implant",
  "invisalign",
  "preventive dentistry",
  "root canal",
  "sedation",
  "teeth whitening",
  "veneer",
];

interface WalkState {
  nodeCount: number;
  maxDepth: number;
  elementTypes: Map<string, number>;
  widgets: Map<string, number>;
  ids: Map<string, number>;
  settingAssignments: number;
  emptySettingAssignments: number;
  shortcodes: Set<string>;
  dynamicBindings: number;
  globalReferences: number;
  customGlobalIds: Set<string>;
  nonEmptyUrlObjects: number;
  targetBoundMediaIds: number;
  externalHosts: Set<string>;
  sensitiveFieldNames: Set<string>;
  settingsKeyPrefixes: Set<string>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toSortedRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function isEmptySetting(value: unknown): boolean {
  if (value === "" || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

function inspectGenericValues(document: unknown, state: WalkState) {
  const stack: unknown[] = [document];
  const urlPattern = /https?:\/\/[^\s"'<>\\)]+/g;
  const sensitivePattern = /password|secret|token|api[_-]?key|private[_-]?key/i;

  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!isRecord(value)) continue;

    if (typeof value.url === "string" && value.url.trim()) {
      state.nonEmptyUrlObjects += 1;
      if (typeof value.id === "number" && value.id > 0) {
        state.targetBoundMediaIds += 1;
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (sensitivePattern.test(key)) state.sensitiveFieldNames.add(key);
      if (typeof child === "string") {
        for (const match of child.match(urlPattern) ?? []) {
          try {
            state.externalHosts.add(new URL(match.replace(/&amp;.*$/, "")).hostname);
          } catch {
            // The URL-shaped value is still preserved in the raw upload.
          }
        }
      } else {
        stack.push(child);
      }
    }
  }
}

function inspectElementorElements(content: unknown[], state: WalkState) {
  const stack = content.map((node) => ({ node, depth: 1 }));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isRecord(current.node)) continue;
    const { node, depth } = current;
    state.nodeCount += 1;
    state.maxDepth = Math.max(state.maxDepth, depth);

    const elementType = typeof node.elType === "string" ? node.elType : "unknown";
    increment(state.elementTypes, elementType);
    if (typeof node.widgetType === "string") increment(state.widgets, node.widgetType);
    if (typeof node.id === "string" && node.id) increment(state.ids, node.id);

    if (isRecord(node.settings)) {
      for (const [key, value] of Object.entries(node.settings)) {
        state.settingAssignments += 1;
        if (isEmptySetting(value)) state.emptySettingAssignments += 1;
        const prefix = key.split("_")[0];
        if (prefix) state.settingsKeyPrefixes.add(prefix);

        if (key === "shortcode" && typeof value === "string" && value.trim()) {
          state.shortcodes.add(value.trim());
        }
      }

      const dynamic = node.settings.__dynamic__;
      if (isRecord(dynamic)) {
        state.dynamicBindings += Object.values(dynamic).filter(
          (value) => typeof value === "string" && value.length > 0,
        ).length;
      }

      const globals = node.settings.__globals__;
      if (isRecord(globals)) {
        for (const value of Object.values(globals)) {
          if (typeof value !== "string" || !value) continue;
          state.globalReferences += 1;
          const id = new URLSearchParams(value.split("?")[1] ?? "").get("id");
          if (id && !STANDARD_GLOBAL_IDS.has(id)) state.customGlobalIds.add(id);
        }
      }
    }

    if (Array.isArray(node.elements)) {
      for (const child of node.elements) {
        stack.push({ node: child, depth: depth + 1 });
      }
    }
  }
}

function createWalkState(): WalkState {
  return {
    nodeCount: 0,
    maxDepth: 0,
    elementTypes: new Map(),
    widgets: new Map(),
    ids: new Map(),
    settingAssignments: 0,
    emptySettingAssignments: 0,
    shortcodes: new Set(),
    dynamicBindings: 0,
    globalReferences: 0,
    customGlobalIds: new Set(),
    nonEmptyUrlObjects: 0,
    targetBoundMediaIds: 0,
    externalHosts: new Set(),
    sensitiveFieldNames: new Set(),
    settingsKeyPrefixes: new Set(),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanTitle(fileName: string, title: unknown): string {
  if (typeof title === "string" && title.trim()) {
    return title.split("|")[0].trim();
  }
  return fileName.replace(/\.json$/i, "").replace(/[-_]+/g, " ").trim();
}

function suggestPage(
  fileName: string,
  title: string,
  documentType: unknown,
  widgets: Map<string, number>,
): TemplateAnalysis["suggestedPage"] {
  const haystack = `${fileName} ${title}`.toLowerCase();
  let role: TemplatePageRole = "custom";
  let confidence = 0.45;
  const reasons: string[] = [];

  if (
    documentType === "single-post" ||
    widgets.has("theme-post-content") ||
    /single[\s-]*(post|blog)/.test(haystack)
  ) {
    role = "blog-single";
    confidence = 0.99;
    reasons.push("The export contains single-post metadata or dynamic post content.");
  } else if (widgets.has("gum_posts_grid") || /blog.*archive|archive.*blog/.test(haystack)) {
    role = "blog-archive";
    confidence = 0.98;
    reasons.push("The export contains an archive grid or archive title.");
  } else if (/\b(home|homepage)\b|premier dental practice/.test(haystack)) {
    role = "homepage";
    confidence = 0.94;
    reasons.push("The filename or title identifies a homepage.");
  } else if (/\babout([\s-]*us)?\b/.test(haystack)) {
    role = "about";
    confidence = 0.96;
    reasons.push("The filename or title identifies an about page.");
  } else if (/\bcontact\b/.test(haystack)) {
    role = "contact";
    confidence = 0.97;
    reasons.push("The filename or title identifies a contact page.");
  } else if (/\b(first|frist)[\s-]*visit\b/.test(haystack)) {
    role = "first-visit";
    confidence = 0.97;
    reasons.push("The filename or title identifies a first-visit page.");
  } else if (/\bmember(ship)?\b|dental plan/.test(haystack)) {
    role = "membership";
    confidence = 0.97;
    reasons.push("The filename or title identifies a membership page.");
  } else if (/\bamenit(y|ies)\b/.test(haystack)) {
    role = "amenities";
    confidence = 0.96;
    reasons.push("The filename or title identifies an amenities page.");
  } else if (/\btechnology\b/.test(haystack)) {
    role = "technology";
    confidence = 0.96;
    reasons.push("The filename or title identifies a technology page.");
  } else if (SERVICE_TERMS.some((term) => haystack.includes(term))) {
    role = "service-page";
    confidence = 0.9;
    reasons.push("The filename or title matches a dental service.");
  } else {
    reasons.push("No standard page role was detected with high confidence.");
  }

  const label = cleanTitle(fileName, title);
  return {
    role,
    label,
    slug: slugify(role === "homepage" ? "home" : label),
    confidence,
    reasons,
  };
}

function detectPlugins(
  widgets: Map<string, number>,
  shortcodes: Set<string>,
  settingsKeyPrefixes: Set<string>,
): { plugins: string[]; unsupportedWidgets: string[]; capabilities: string[] } {
  const plugins = new Set<string>();
  const unsupportedWidgets = new Set<string>();
  const capabilities = new Set<string>();

  for (const widget of widgets.keys()) {
    if (STANDARD_WIDGETS.has(widget)) continue;
    if (ELEMENTOR_PRO_WIDGETS.has(widget)) {
      plugins.add("Elementor Pro");
      capabilities.add("dynamic-post-template");
      continue;
    }
    if (widget.startsWith("elementskit-")) {
      plugins.add("ElementsKit");
      unsupportedWidgets.add(widget);
      continue;
    }
    if (widget.startsWith("gum_")) {
      plugins.add("GUM widget family");
      unsupportedWidgets.add(widget);
      continue;
    }
    if (widget.startsWith("e-")) {
      plugins.add("Elementor Atomic Elements");
      capabilities.add("atomic-elements");
      continue;
    }
    plugins.add("Custom or third-party Elementor widget");
    unsupportedWidgets.add(widget);
  }

  if ([...shortcodes].some((value) => /trustindex/i.test(value))) {
    plugins.add("Trustindex");
  }
  if (settingsKeyPrefixes.has("cms") || settingsKeyPrefixes.has("cmsmasters")) {
    plugins.add("CMSMasters controls");
  }

  return {
    plugins: [...plugins].sort(),
    unsupportedWidgets: [...unsupportedWidgets].sort(),
    capabilities: [...capabilities].sort(),
  };
}

function warning(
  code: string,
  severity: TemplateWarning["severity"],
  title: string,
  message: string,
  remediation: string,
): TemplateWarning {
  return { code, severity, title, message, remediation };
}

function statusFromWarnings(warnings: TemplateWarning[]): TemplateAnalysisStatus {
  if (warnings.some((item) => item.severity === "blocker")) return "blocked";
  if (warnings.some((item) => item.severity === "warning")) return "review";
  return "ready";
}

export function analyzeTemplateJson(input: AnalyzeTemplateInput): TemplateAnalysis {
  const state = createWalkState();
  inspectGenericValues(input.document, state);
  const document = isRecord(input.document) ? input.document : {};
  const topLevelKeys = Object.keys(document).sort();
  const isElementor =
    Array.isArray(document.content) &&
    topLevelKeys.includes("title") &&
    topLevelKeys.includes("type") &&
    topLevelKeys.includes("version");

  if (isElementor) inspectElementorElements(document.content as unknown[], state);

  const duplicateElementIds = [...state.ids.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const title = cleanTitle(input.fileName, document.title);
  const suggestedPage = suggestPage(
    input.fileName,
    title,
    document.type,
    state.widgets,
  );
  const pluginInfo = detectPlugins(
    state.widgets,
    state.shortcodes,
    state.settingsKeyPrefixes,
  );
  const warnings: TemplateWarning[] = [];

  if (!isElementor) {
    warnings.push(
      warning(
        "generic-json-manual-mapping",
        "warning",
        "Manual field mapping required",
        "This JSON does not match the recognized Elementor export envelope.",
        "Use the generic path mapper or add a specialized adapter for this format.",
      ),
    );
  }
  if (state.sensitiveFieldNames.size > 0) {
    warnings.push(
      warning(
        "potential-sensitive-fields",
        "blocker",
        "Potential credentials detected",
        `${state.sensitiveFieldNames.size} field name(s) resemble credentials or private keys.`,
        "Remove secrets before mapping or saving this template.",
      ),
    );
  }
  if (duplicateElementIds.length > 0) {
    warnings.push(
      warning(
        "duplicate-element-ids",
        "blocker",
        "Duplicate Elementor IDs",
        `${duplicateElementIds.length} element ID(s) are reused in this file.`,
        "Regenerate the duplicated IDs before deployment.",
      ),
    );
  }
  if (pluginInfo.unsupportedWidgets.length > 0) {
    warnings.push(
      warning(
        "third-party-widgets",
        "warning",
        "Third-party widgets require review",
        `${pluginInfo.unsupportedWidgets.length} widget type(s) need a plugin or translation adapter.`,
        "Confirm the destination plugin inventory or map these widgets to native Atomic elements.",
      ),
    );
  }
  if (state.targetBoundMediaIds > 0) {
    warnings.push(
      warning(
        "source-media-ids",
        "warning",
        "Source WordPress media IDs found",
        `${state.targetBoundMediaIds} media reference(s) contain IDs from the source site.`,
        "Upload the assets through the media registry and replace both IDs and URLs.",
      ),
    );
  }
  if (state.customGlobalIds.size > 0) {
    warnings.push(
      warning(
        "custom-global-ids",
        "warning",
        "Custom global style IDs found",
        `${state.customGlobalIds.size} custom global color or typography ID(s) may not exist on the destination.`,
        "Rebind them to the Energize Atomic Foundation during compilation.",
      ),
    );
  }
  if (state.externalHosts.size > 1) {
    warnings.push(
      warning(
        "multiple-source-domains",
        "warning",
        "Multiple external domains found",
        `The template references ${state.externalHosts.size} external hosts.`,
        "Review every cross-domain link and migrate source-site media before deployment.",
      ),
    );
  }
  if (state.settingAssignments > 2_000) {
    warnings.push(
      warning(
        "large-control-payload",
        "info",
        "Large layout-control payload",
        `${state.settingAssignments.toLocaleString()} setting assignments were detected.`,
        "Keep the raw values but collapse inactive layout controls in the mapping interface.",
      ),
    );
  }
  if (state.elementTypes.has("e-flexbox") || pluginInfo.capabilities.includes("atomic-elements")) {
    warnings.push(
      warning(
        "mixed-element-families",
        "info",
        "Mixed Elementor element families",
        "This export includes atomic-style elements alongside legacy containers or widgets.",
        "Select the compiler by detected capabilities instead of trusting the file label alone.",
      ),
    );
  }

  const capabilities = new Set(pluginInfo.capabilities);
  if (isElementor) capabilities.add("elementor-tree");
  if (state.elementTypes.has("e-flexbox")) capabilities.add("atomic-elements");
  if (state.dynamicBindings > 0) capabilities.add("dynamic-bindings");
  if (state.shortcodes.size > 0) capabilities.add("shortcodes");

  return {
    id: `${input.checksum.slice(0, 16)}-${slugify(input.fileName)}`,
    file: {
      name: input.fileName,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
    },
    status: statusFromWarnings(warnings),
    format: {
      family: isElementor ? "elementor-export" : "generic-json",
      label: isElementor ? "Elementor template export" : "Generic JSON",
      exportVersion:
        typeof document.version === "string" ? document.version : undefined,
      confidence: isElementor ? 0.99 : 0.6,
      capabilities: [...capabilities].sort(),
    },
    suggestedPage,
    structure: {
      rootElements: Array.isArray(document.content) ? document.content.length : 0,
      nodeCount: state.nodeCount,
      maxDepth: state.maxDepth,
      elementTypes: toSortedRecord(state.elementTypes),
      widgets: toSortedRecord(state.widgets),
      duplicateElementIds,
      settingAssignments: state.settingAssignments,
      emptySettingAssignments: state.emptySettingAssignments,
      topLevelKeys,
    },
    dependencies: {
      plugins: pluginInfo.plugins,
      unsupportedWidgets: pluginInfo.unsupportedWidgets,
      shortcodes: [...state.shortcodes].sort(),
      dynamicBindings: state.dynamicBindings,
      globalReferences: state.globalReferences,
      customGlobalIds: [...state.customGlobalIds].sort(),
      nonEmptyUrlObjects: state.nonEmptyUrlObjects,
      targetBoundMediaIds: state.targetBoundMediaIds,
      externalHosts: [...state.externalHosts].sort(),
      sensitiveFieldNames: [...state.sensitiveFieldNames].sort(),
    },
    warnings,
  };
}

export function invalidTemplateAnalysis(input: {
  fileName: string;
  sizeBytes: number;
  checksum: string;
  message: string;
}): TemplateAnalysis {
  const title = cleanTitle(input.fileName, undefined);
  const warningItem = warning(
    "invalid-json",
    "blocker",
    "Invalid JSON",
    input.message,
    "Export the file again or correct the JSON syntax before retrying.",
  );
  return {
    id: `${input.checksum.slice(0, 16)}-${slugify(input.fileName)}`,
    file: {
      name: input.fileName,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
    },
    status: "blocked",
    format: {
      family: "invalid-json",
      label: "Invalid JSON",
      confidence: 1,
      capabilities: [],
    },
    suggestedPage: {
      role: "custom",
      label: title,
      slug: slugify(title),
      confidence: 0,
      reasons: ["The file must be valid JSON before a page role can be suggested."],
    },
    structure: {
      rootElements: 0,
      nodeCount: 0,
      maxDepth: 0,
      elementTypes: {},
      widgets: {},
      duplicateElementIds: [],
      settingAssignments: 0,
      emptySettingAssignments: 0,
      topLevelKeys: [],
    },
    dependencies: {
      plugins: [],
      unsupportedWidgets: [],
      shortcodes: [],
      dynamicBindings: 0,
      globalReferences: 0,
      customGlobalIds: [],
      nonEmptyUrlObjects: 0,
      targetBoundMediaIds: 0,
      externalHosts: [],
      sensitiveFieldNames: [],
    },
    warnings: [warningItem],
  };
}
