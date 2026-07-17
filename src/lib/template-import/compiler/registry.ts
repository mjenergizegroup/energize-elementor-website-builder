import type {
  CompiledTemplatePage,
  TemplateCompileTransformations,
  TemplateWarning,
} from "../types";
import { elementorV3Compiler } from "./elementor-v3";
import type {
  TemplateCompilerInput,
  TemplateCompilerStrategy,
} from "./types";

const COMPILERS: readonly TemplateCompilerStrategy[] = [elementorV3Compiler];

const EMPTY_TRANSFORMATIONS: TemplateCompileTransformations = {
  elementIdsRegenerated: 0,
  duplicateIdsResolved: 0,
  mediaIdsCleared: 0,
  globalReferencesPreserved: 0,
  dynamicBindingsPreserved: 0,
  unsupportedWidgetsPreserved: 0,
};

function blockedResult(
  input: TemplateCompilerInput,
  warning: TemplateWarning,
): CompiledTemplatePage {
  return {
    analysisId: input.analysis.id,
    fileName: input.analysis.file.name,
    checksum: input.analysis.file.checksum,
    status: "blocked",
    deployable: false,
    targetKind:
      input.mapping.role === "blog-single"
        ? "elementor-theme-template"
        : "wp-page",
    mapping: {
      role: input.mapping.role,
      title: input.mapping.title,
      slug: input.mapping.slug,
      selected: input.mapping.selected,
    },
    compiler: { id: "unavailable", version: "1" },
    transformations: { ...EMPTY_TRANSFORMATIONS },
    pending: {
      externalHosts: input.analysis.dependencies.externalHosts,
      customGlobalIds: input.analysis.dependencies.customGlobalIds,
      plugins: input.analysis.dependencies.plugins,
      unsupportedWidgets: input.analysis.dependencies.unsupportedWidgets,
      shortcodes: input.analysis.dependencies.shortcodes,
    },
    warnings: [warning],
    wordpress: {
      status: "draft",
      pageTemplate: "elementor_header_footer",
    },
  };
}

export function getTemplateCompiler(
  input: TemplateCompilerInput,
): TemplateCompilerStrategy | undefined {
  return COMPILERS.find((compiler) => compiler.supports(input.analysis));
}

export function compileTemplate(
  input: TemplateCompilerInput,
): CompiledTemplatePage {
  if (input.analysis.dependencies.sensitiveFieldNames.length > 0) {
    return blockedResult(input, {
      code: "sensitive-fields-blocked",
      severity: "blocker",
      title: "Potential credentials blocked",
      message: "The compiler will not copy a file containing credential-like field names.",
      remediation: "Remove secrets and analyze the file again.",
    });
  }

  const compiler = getTemplateCompiler(input);
  if (!compiler) {
    return blockedResult(input, {
      code: "compiler-unavailable",
      severity: "blocker",
      title: "No compiler is available",
      message: `The ${input.analysis.format.label} format does not have a registered compiler.`,
      remediation: "Add a specialized adapter for this JSON format before compilation.",
    });
  }

  try {
    return compiler.compile(input);
  } catch (error) {
    return blockedResult(input, {
      code: "compile-failed",
      severity: "blocker",
      title: "Compilation failed",
      message: error instanceof Error ? error.message : "The compiler could not create an artifact.",
      remediation: "Analyze the file structure and add or repair the matching adapter.",
    });
  }
}
