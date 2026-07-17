import { generateElementId } from "@/lib/injection/elementor";
import type {
  TemplateAnalysisStatus,
  TemplateCompileTargetKind,
  TemplateCompileTransformations,
  TemplateWarning,
} from "../types";
import type {
  TemplateCompilerInput,
  TemplateCompilerStrategy,
} from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compileWarning(
  code: string,
  severity: TemplateWarning["severity"],
  title: string,
  message: string,
  remediation: string,
): TemplateWarning {
  return { code, severity, title, message, remediation };
}

function compileStatus(warnings: TemplateWarning[]): TemplateAnalysisStatus {
  if (warnings.some((item) => item.severity === "blocker")) return "blocked";
  if (warnings.some((item) => item.severity === "warning")) return "review";
  return "ready";
}

function targetKindFor(role: TemplateCompilerInput["mapping"]["role"]): TemplateCompileTargetKind {
  return role === "blog-single" ? "elementor-theme-template" : "wp-page";
}

function transformArtifact(
  artifact: JsonRecord,
  duplicateIdsResolved: number,
): TemplateCompileTransformations {
  const transformations: TemplateCompileTransformations = {
    elementIdsRegenerated: 0,
    duplicateIdsResolved,
    mediaIdsCleared: 0,
    globalReferencesPreserved: 0,
    dynamicBindingsPreserved: 0,
    unsupportedWidgetsPreserved: 0,
  };
  const generatedIds = new Set<string>();
  const stack: unknown[] = [artifact];

  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!isRecord(value)) continue;

    if (typeof value.elType === "string") {
      let nextId = generateElementId();
      while (generatedIds.has(nextId)) nextId = generateElementId();
      value.id = nextId;
      generatedIds.add(nextId);
      transformations.elementIdsRegenerated += 1;
    }

    if (
      typeof value.url === "string" &&
      value.url.trim() &&
      typeof value.id === "number" &&
      value.id > 0
    ) {
      value.id = "";
      transformations.mediaIdsCleared += 1;
    }

    if (isRecord(value.__globals__)) {
      transformations.globalReferencesPreserved += Object.values(
        value.__globals__,
      ).filter((item) => typeof item === "string" && item.length > 0).length;
    }
    if (isRecord(value.__dynamic__)) {
      transformations.dynamicBindingsPreserved += Object.values(
        value.__dynamic__,
      ).filter((item) => typeof item === "string" && item.length > 0).length;
    }

    stack.push(...Object.values(value));
  }

  return transformations;
}

export const elementorV3Compiler: TemplateCompilerStrategy = {
  id: "elementor-v3-portable",
  version: "1",

  supports(analysis) {
    return analysis.format.family === "elementor-export";
  },

  compile(input) {
    const artifact = structuredClone(input.document);
    if (!isRecord(artifact) || !Array.isArray(artifact.content)) {
      throw new Error("The recognized Elementor export no longer contains a content tree.");
    }

    artifact.title = input.mapping.title;
    const transformations = transformArtifact(
      artifact,
      input.analysis.structure.duplicateElementIds.length,
    );
    transformations.unsupportedWidgetsPreserved =
      input.analysis.dependencies.unsupportedWidgets.length;

    const warnings: TemplateWarning[] = [];
    const targetKind = targetKindFor(input.mapping.role);

    if (transformations.duplicateIdsResolved > 0) {
      warnings.push(
        compileWarning(
          "duplicate-ids-repaired",
          "info",
          "Duplicate IDs repaired",
          `${transformations.duplicateIdsResolved} reused source ID(s) were replaced while every element received a new ID.`,
          "No manual action is required.",
        ),
      );
    }
    if (transformations.mediaIdsCleared > 0) {
      warnings.push(
        compileWarning(
          "media-remap-required",
          "warning",
          "Media migration required",
          `${transformations.mediaIdsCleared} source WordPress media ID(s) were cleared while their URLs were retained.`,
          "Import each asset into the destination media library and replace the retained URL and new ID before deployment.",
        ),
      );
    }
    if (input.analysis.dependencies.externalHosts.length > 0) {
      warnings.push(
        compileWarning(
          "external-host-review",
          "warning",
          "External URLs remain",
          `The portable artifact references ${input.analysis.dependencies.externalHosts.length} external host(s).`,
          "Classify each URL as a destination link, approved embed, or asset that must be migrated.",
        ),
      );
    }
    if (input.analysis.dependencies.customGlobalIds.length > 0) {
      warnings.push(
        compileWarning(
          "global-remap-required",
          "warning",
          "Global styles need mapping",
          `${input.analysis.dependencies.customGlobalIds.length} custom global style ID(s) were preserved.`,
          "Map the source global IDs to Energize Atomic Foundation variables before deployment.",
        ),
      );
    }
    if (input.analysis.dependencies.unsupportedWidgets.length > 0) {
      warnings.push(
        compileWarning(
          "widget-adapter-required",
          "warning",
          "Widget adapters required",
          `${input.analysis.dependencies.unsupportedWidgets.length} third-party widget type(s) were preserved unchanged.`,
          "Confirm the destination plugins or translate these widgets before deployment.",
        ),
      );
    }
    if (input.analysis.dependencies.plugins.length > 0) {
      warnings.push(
        compileWarning(
          "plugin-inventory-review",
          "warning",
          "Plugin inventory requires confirmation",
          `${input.analysis.dependencies.plugins.length} plugin dependency group(s) were detected.`,
          "Confirm the destination plugin inventory before deployment.",
        ),
      );
    }
    if (input.analysis.dependencies.shortcodes.length > 0) {
      warnings.push(
        compileWarning(
          "shortcode-review",
          "warning",
          "Shortcodes were preserved",
          `${input.analysis.dependencies.shortcodes.length} shortcode value(s) still depend on destination configuration.`,
          "Confirm each shortcode provider and destination configuration.",
        ),
      );
    }
    if (input.analysis.dependencies.dynamicBindings > 0) {
      warnings.push(
        compileWarning(
          "dynamic-binding-review",
          "warning",
          "Dynamic bindings were preserved",
          `${input.analysis.dependencies.dynamicBindings} dynamic binding(s) require destination context.`,
          "Verify the post type, query context, and required Elementor Pro features.",
        ),
      );
    }
    if (targetKind === "elementor-theme-template") {
      warnings.push(
        compileWarning(
          "theme-template-target",
          "warning",
          "Theme Builder destination required",
          "This artifact represents a single-post template, not a normal WordPress page.",
          "Deploy it through an Elementor Theme Builder adapter after display conditions are defined.",
        ),
      );
    }

    const status = compileStatus(warnings);
    return {
      analysisId: input.analysis.id,
      fileName: input.analysis.file.name,
      checksum: input.analysis.file.checksum,
      status,
      deployable: status === "ready" && targetKind === "wp-page",
      targetKind,
      mapping: {
        role: input.mapping.role,
        title: input.mapping.title,
        slug: input.mapping.slug,
        selected: input.mapping.selected,
      },
      compiler: { id: this.id, version: this.version },
      transformations,
      pending: {
        externalHosts: input.analysis.dependencies.externalHosts,
        customGlobalIds: input.analysis.dependencies.customGlobalIds,
        plugins: input.analysis.dependencies.plugins,
        unsupportedWidgets: input.analysis.dependencies.unsupportedWidgets,
        shortcodes: input.analysis.dependencies.shortcodes,
      },
      warnings,
      wordpress: {
        status: "draft",
        pageTemplate: "elementor_header_footer",
      },
      artifact,
    };
  },
};
