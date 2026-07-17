import { elementorV3AtomicAdapter } from "./elementor-v3-atomic";
import type { TemplateConversionAdapter } from "./types";

const ADAPTERS: readonly TemplateConversionAdapter[] = [elementorV3AtomicAdapter];

export function getConversionAdapter(document: unknown): TemplateConversionAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.supports(document));
}

export function convertTemplateToAtomic(document: unknown) {
  const adapter = getConversionAdapter(document);
  if (!adapter) throw new Error("No versioned conversion adapter supports this template.");
  return adapter.convert(document);
}
