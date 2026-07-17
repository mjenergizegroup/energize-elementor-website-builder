import type {
  CompiledTemplatePage,
  TemplateAnalysis,
  TemplateMappingSelection,
} from "../types";

export interface TemplateCompilerInput {
  analysis: TemplateAnalysis;
  document: unknown;
  mapping: TemplateMappingSelection;
}

export interface TemplateCompilerStrategy {
  readonly id: string;
  readonly version: string;
  supports(analysis: TemplateAnalysis): boolean;
  compile(input: TemplateCompilerInput): CompiledTemplatePage;
}
