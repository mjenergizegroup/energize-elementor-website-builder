import type {
  CompiledTemplatePage,
  TemplateCompileBundle,
} from "@/lib/template-import/types";
import { convertTemplateToAtomic } from "../content/registry";
import { injectNormalizedContent } from "../content/inject";
import type { TemplateContentMapping } from "../content/types";
import {
  migrationReadiness,
  reconcileDependencyLedger,
} from "../dependencies";
import type { MigrationResolution } from "../types";
import type { MigrationDeploymentPreflight } from "./types";

const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_ARTIFACT_NODES = 50_000;
const MAX_ARTIFACT_DEPTH = 100;
const SENSITIVE_KEY = /(?:password|passwd|secret|api[_-]?key|private[_-]?key|token)$/i;

export function preflightMigrationDeployment(
  bundle: TemplateCompileBundle,
  resolutions: MigrationResolution[],
  contentMappings: TemplateContentMapping[] = [],
): MigrationDeploymentPreflight {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const pages: MigrationDeploymentPreflight["pages"] = [];
  const selected = bundle.pages.filter((page) => page.mapping.selected);
  const slugs = new Set<string>();
  const reconciled = reconcileDependencyLedger(bundle, resolutions);
  const resolutionState = migrationReadiness(reconciled);

  if (selected.length === 0) blockers.push("Select at least one compiled page.");
  blockers.push(...resolutionState.reasons.map((reason) => `Dependency not ready: ${reason}.`));
  for (const resolution of reconciled) {
    if (resolution.status === "accepted") {
      warnings.push(`Accepted exception: ${resolution.kind} ${resolution.source}.`);
    }
  }

  for (const page of selected) {
    if (slugs.has(page.mapping.slug)) {
      blockers.push(`Duplicate destination slug: ${page.mapping.slug}.`);
      continue;
    }
    slugs.add(page.mapping.slug);
    if (page.status === "blocked") {
      blockers.push(`${page.mapping.title} is blocked by its compiler review.`);
      continue;
    }
    if (page.targetKind !== "wp-page") {
      blockers.push(
        `${page.mapping.title} requires an Elementor Theme Builder adapter and cannot be deployed as a normal page.`,
      );
      continue;
    }
    if (!page.artifact) {
      blockers.push(`${page.mapping.title} has no compiled artifact.`);
      continue;
    }
    const artifactErrors = validateArtifact(page.artifact);
    if (artifactErrors.length > 0) {
      blockers.push(
        ...artifactErrors.map((error) => `${page.mapping.title}: ${error}`),
      );
      continue;
    }

    const artifact = materializeArtifact(page, reconciled);
    const converted = deployableContent(artifact);
    if (converted.errors.length > 0) {
      blockers.push(
        ...converted.errors.map((error) => `${page.mapping.title}: ${error}`),
      );
      continue;
    }
    warnings.push(
      ...converted.warnings.map(
        (warning) => `${page.mapping.title}: ${warning}`,
      ),
    );
    const contentMapping = contentMappings.find(
      (mapping) => mapping.analysisId === page.analysisId,
    );
    if (contentMappings.length > 0 && !contentMapping) {
      blockers.push(`${page.mapping.title}: approved source content is not mapped.`);
      continue;
    }
    const injection = contentMapping
      ? injectNormalizedContent(converted.content, contentMapping.content)
      : undefined;
    if (injection) {
      warnings.push(
        `${page.mapping.title}: injected ${injection.replaced} template slot(s), appended ${injection.appended}, and removed ${injection.removedPlaceholders} unused placeholder(s).`,
      );
    }
    const content = injection?.elementorData ?? converted.content;
    const injectedErrors = validateArtifact({ content });
    if (injectedErrors.length > 0) {
      blockers.push(
        ...injectedErrors.map((error) => `${page.mapping.title}: ${error}`),
      );
      continue;
    }
    if (!Array.isArray(content)) {
      blockers.push(`${page.mapping.title}: compiled content is not an array.`);
      continue;
    }
    pages.push({
      analysisId: page.analysisId,
      title: page.mapping.title,
      slug: page.mapping.slug,
      elementorData: content,
      elementorVersion: "4.1.1",
      pageTemplate: page.wordpress.pageTemplate,
    });
  }

  return {
    ready: blockers.length === 0 && pages.length === selected.length,
    blockers: unique(blockers),
    warnings: unique(warnings),
    pages,
  };
}

function deployableContent(artifact: Record<string, unknown>): {
  content: unknown[];
  errors: string[];
  warnings: string[];
} {
  if (!Array.isArray(artifact.content)) {
    return { content: [], errors: ["compiled content is not an array."], warnings: [] };
  }
  if (isAtomicContent(artifact.content)) {
    return { content: artifact.content, errors: [], warnings: [] };
  }
  try {
    const conversion = convertTemplateToAtomic(artifact);
    const convertedErrors = validateArtifact({ content: conversion.elementorData });
    return {
      content: conversion.elementorData,
      errors: convertedErrors,
      warnings: conversion.reviewItems.map((item) => item.message),
    };
  } catch (error) {
    return {
      content: [],
      errors: [
        error instanceof Error
          ? `Atomic conversion failed: ${error.message}`
          : "Atomic conversion failed.",
      ],
      warnings: [],
    };
  }
}

function isAtomicContent(content: unknown[]): boolean {
  let count = 0;
  const stack: unknown[] = [...content];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!isRecord(value)) return false;
    const elementType = value.elType;
    const widgetType = value.widgetType;
    const atomicLayout =
      elementType === "e-flexbox" ||
      elementType === "e-div-block" ||
      elementType === "e-grid";
    const atomicWidget =
      elementType === "widget" &&
      typeof widgetType === "string" &&
      (widgetType.startsWith("e-") ||
        widgetType === "html" ||
        widgetType === "shortcode" ||
        widgetType === "google_maps");
    if (!atomicLayout && !atomicWidget) return false;
    count += 1;
    if (Array.isArray(value.elements)) stack.push(...value.elements);
  }
  return count > 0;
}

export function validateArtifact(
  artifact: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const serialized = JSON.stringify(artifact);
  if (Buffer.byteLength(serialized, "utf8") > MAX_ARTIFACT_BYTES) {
    errors.push("artifact exceeds the 2MB limit.");
    return errors;
  }

  const stack: Array<{ value: unknown; depth: number }> = [
    { value: artifact, depth: 0 },
  ];
  const elementIds = new Set<string>();
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > MAX_ARTIFACT_NODES) {
      errors.push("artifact exceeds the node limit.");
      break;
    }
    if (current.depth > MAX_ARTIFACT_DEPTH) {
      errors.push("artifact exceeds the nesting limit.");
      break;
    }
    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        stack.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }
    if (!isRecord(current.value)) continue;

    for (const key of Object.keys(current.value)) {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        errors.push(`unsafe object key "${key}" is not allowed.`);
      }
      if (SENSITIVE_KEY.test(key)) {
        errors.push(`credential-like field "${key}" is not allowed.`);
      }
    }
    if (typeof current.value.elType === "string") {
      if (
        typeof current.value.id !== "string" ||
        !/^[a-f0-9]{8}$/.test(current.value.id)
      ) {
        errors.push("every Elementor node must have an 8-character hex ID.");
      } else if (elementIds.has(current.value.id)) {
        errors.push(`duplicate Elementor ID "${current.value.id}" remains.`);
      } else {
        elementIds.add(current.value.id);
      }
    }
    for (const value of Object.values(current.value)) {
      stack.push({ value, depth: current.depth + 1 });
    }
  }
  return unique(errors);
}

function materializeArtifact(
  page: CompiledTemplatePage,
  resolutions: MigrationResolution[],
): Record<string, unknown> {
  const artifact = structuredClone(page.artifact ?? {});
  const mediaMappings = new Map<
    string,
    { destinationUrl: string; destinationMediaId: number }
  >();
  const globalMappings = new Map<string, string>();

  for (const resolution of resolutions) {
    if (resolution.status !== "resolved") continue;
    if (resolution.kind === "media" && resolution.source === page.analysisId) {
      const mappings = resolution.resolution?.mappings;
      if (!Array.isArray(mappings)) continue;
      for (const mapping of mappings) {
        if (!isRecord(mapping)) continue;
        if (
          typeof mapping.sourceUrl === "string" &&
          typeof mapping.destinationUrl === "string" &&
          typeof mapping.destinationMediaId === "number"
        ) {
          mediaMappings.set(mapping.sourceUrl, {
            destinationUrl: mapping.destinationUrl,
            destinationMediaId: mapping.destinationMediaId,
          });
        }
      }
    }
    if (
      resolution.kind === "global-style" &&
      typeof resolution.resolution?.destinationId === "string"
    ) {
      globalMappings.set(
        resolution.source,
        resolution.resolution.destinationId,
      );
    }
  }

  const stack: unknown[] = [artifact];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!isRecord(value)) continue;
    if (typeof value.url === "string") {
      const mapping = mediaMappings.get(value.url);
      if (mapping) {
        value.url = mapping.destinationUrl;
        value.id = mapping.destinationMediaId;
      }
    }
    if (isRecord(value.__globals__)) {
      for (const [key, sourceId] of Object.entries(value.__globals__)) {
        if (typeof sourceId !== "string") continue;
        const destinationId = globalMappings.get(sourceId);
        if (destinationId) value.__globals__[key] = destinationId;
      }
    }
    stack.push(...Object.values(value));
  }
  return artifact;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
