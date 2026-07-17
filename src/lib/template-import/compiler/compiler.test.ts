import assert from "node:assert/strict";
import { analyzeTemplateJson } from "../analyze";
import type { TemplateMappingSelection } from "../types";
import { compileTemplate, getTemplateCompiler } from "./index";
import { parseTemplateCompileManifest } from "./manifest";

function analyze(fileName: string, document: unknown) {
  return analyzeTemplateJson({
    fileName,
    sizeBytes: JSON.stringify(document).length,
    checksum: "c".repeat(64),
    document,
  });
}

function mappingFor(
  analysis: ReturnType<typeof analyze>,
  patch: Partial<TemplateMappingSelection> = {},
): TemplateMappingSelection {
  return {
    analysisId: analysis.id,
    fileName: analysis.file.name,
    checksum: analysis.file.checksum,
    selected: true,
    role: analysis.suggestedPage.role,
    title: analysis.suggestedPage.label,
    slug: analysis.suggestedPage.slug,
    status: analysis.status,
    ...patch,
  };
}

const portableSource = {
  title: "Source Title",
  type: "page",
  version: "0.4",
  page_settings: [],
  content: [
    {
      id: "same",
      elType: "container",
      settings: {
        __globals__: { background_color: "globals/colors?id=custom-red" },
        background_image: {
          id: 42,
          url: "https://source.example.com/uploads/hero.jpg",
        },
      },
      elements: [
        {
          id: "same",
          elType: "widget",
          widgetType: "heading",
          settings: { title: "Hello" },
          elements: [],
        },
      ],
    },
  ],
};
const portableAnalysis = analyze("homepage.json", portableSource);
const portable = compileTemplate({
  analysis: portableAnalysis,
  document: portableSource,
  mapping: mappingFor(portableAnalysis, {
    role: "homepage",
    title: "New Homepage",
    slug: "home",
  }),
});

assert.equal(getTemplateCompiler({
  analysis: portableAnalysis,
  document: portableSource,
  mapping: mappingFor(portableAnalysis),
})?.id, "elementor-v3-portable");
assert.equal(portable.status, "review");
assert.equal(portable.deployable, false);
assert.equal(portable.transformations.elementIdsRegenerated, 2);
assert.equal(portable.transformations.duplicateIdsResolved, 1);
assert.equal(portable.transformations.mediaIdsCleared, 1);
assert.ok(portable.warnings.some((item) => item.code === "duplicate-ids-repaired"));
assert.ok(portable.warnings.some((item) => item.code === "media-remap-required"));

const portableArtifact = portable.artifact!;
assert.equal(portableArtifact.title, "New Homepage");
const portableContent = portableArtifact.content as Array<Record<string, unknown>>;
const firstId = portableContent[0].id as string;
const child = (portableContent[0].elements as Array<Record<string, unknown>>)[0];
const secondId = child.id as string;
assert.match(firstId, /^[a-f0-9]{8}$/);
assert.match(secondId, /^[a-f0-9]{8}$/);
assert.notEqual(firstId, secondId);
const settings = portableContent[0].settings as Record<string, unknown>;
assert.equal((settings.background_image as Record<string, unknown>).id, "");
assert.equal(portableSource.content[0].id, "same");
assert.equal(portableSource.content[0].settings.background_image.id, 42);

const cleanSource = {
  title: "About",
  type: "page",
  version: "0.4",
  content: [
    {
      id: "about1",
      elType: "widget",
      widgetType: "heading",
      settings: { title: "About" },
      elements: [],
    },
  ],
};
const cleanAnalysis = analyze("about-us.json", cleanSource);
const clean = compileTemplate({
  analysis: cleanAnalysis,
  document: cleanSource,
  mapping: mappingFor(cleanAnalysis),
});
assert.equal(clean.status, "ready");
assert.equal(clean.deployable, true);

const blogSource = {
  title: "Blog Single",
  type: "single-post",
  version: "0.4",
  content: [
    {
      id: "post1",
      elType: "widget",
      widgetType: "theme-post-content",
      settings: {},
      elements: [],
    },
  ],
};
const blogAnalysis = analyze("Blog Single Post.json", blogSource);
const blog = compileTemplate({
  analysis: blogAnalysis,
  document: blogSource,
  mapping: mappingFor(blogAnalysis),
});
assert.equal(blog.targetKind, "elementor-theme-template");
assert.equal(blog.deployable, false);
assert.ok(blog.warnings.some((item) => item.code === "theme-template-target"));

const genericSource = { blocks: [{ type: "hero" }] };
const genericAnalysis = analyze("generic.json", genericSource);
const generic = compileTemplate({
  analysis: genericAnalysis,
  document: genericSource,
  mapping: mappingFor(genericAnalysis),
});
assert.equal(generic.status, "blocked");
assert.equal(generic.artifact, undefined);
assert.equal(generic.warnings[0].code, "compiler-unavailable");

const sensitiveSource = {
  title: "Unsafe",
  type: "page",
  version: "0.4",
  api_key: "redacted",
  content: [],
};
const sensitiveAnalysis = analyze("unsafe.json", sensitiveSource);
const sensitive = compileTemplate({
  analysis: sensitiveAnalysis,
  document: sensitiveSource,
  mapping: mappingFor(sensitiveAnalysis, { selected: true }),
});
assert.equal(sensitive.status, "blocked");
assert.equal(sensitive.warnings[0].code, "sensitive-fields-blocked");

const manifest = parseTemplateCompileManifest({
  schemaVersion: "1",
  createdAt: new Date().toISOString(),
  mappings: [mappingFor(cleanAnalysis)],
});
assert.equal(manifest.mappings.length, 1);
assert.throws(() =>
  parseTemplateCompileManifest({
    schemaVersion: "1",
    createdAt: "not-a-date",
    mappings: [mappingFor(cleanAnalysis)],
  }),
);

console.log("template compiler tests passed");
