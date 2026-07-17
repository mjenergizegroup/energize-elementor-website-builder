import assert from "node:assert/strict";
import {
  analyzeTemplateJson,
  invalidTemplateAnalysis,
} from "./analyze";

function analyze(fileName: string, document: unknown) {
  return analyzeTemplateJson({
    fileName,
    sizeBytes: JSON.stringify(document).length,
    checksum: "a".repeat(64),
    document,
  });
}

const service = analyze("clear-aligners.json", {
  title: "Clear Aligners in Wilmington | Example Dentistry",
  type: "page",
  version: "0.4",
  page_settings: [],
  content: [
    {
      id: "hero1",
      elType: "container",
      settings: {
        __globals__: { background_color: "globals/colors?id=custom123" },
        background_image: {
          id: 45,
          url: "https://source.example.com/uploads/hero.jpg",
        },
      },
      elements: [
        {
          id: "faq1",
          elType: "widget",
          widgetType: "elementskit-accordion",
          settings: { ekit_accordion_items: [] },
          elements: [],
        },
      ],
    },
  ],
});

assert.equal(service.format.family, "elementor-export");
assert.equal(service.suggestedPage.role, "service-page");
assert.equal(service.structure.nodeCount, 2);
assert.deepEqual(service.dependencies.plugins, ["ElementsKit"]);
assert.equal(service.dependencies.targetBoundMediaIds, 1);
assert.deepEqual(service.dependencies.customGlobalIds, ["custom123"]);
assert.equal(service.status, "review");

const blog = analyze("Blog Single Post.json", {
  title: "Blog Single Post",
  type: "single-post",
  version: "0.4",
  page_settings: [],
  content: [
    {
      id: "post1",
      elType: "e-flexbox",
      settings: {},
      elements: [
        {
          id: "post2",
          elType: "widget",
          widgetType: "theme-post-content",
          settings: { __dynamic__: { image: "post-featured-image" } },
          elements: [],
        },
      ],
    },
  ],
});

assert.equal(blog.suggestedPage.role, "blog-single");
assert.ok(blog.format.capabilities.includes("dynamic-post-template"));
assert.ok(blog.format.capabilities.includes("atomic-elements"));
assert.ok(blog.warnings.some((item) => item.code === "mixed-element-families"));

const generic = analyze("unknown.json", {
  pageName: "A Different Format",
  blocks: [{ kind: "hero", copy: "Hello" }],
});

assert.equal(generic.format.family, "generic-json");
assert.equal(generic.status, "review");
assert.ok(generic.warnings.some((item) => item.code === "generic-json-manual-mapping"));

const duplicate = analyze("duplicate.json", {
  title: "Duplicate",
  type: "page",
  version: "0.4",
  content: [
    { id: "same", elType: "container", settings: {}, elements: [] },
    { id: "same", elType: "container", settings: {}, elements: [] },
  ],
});

assert.equal(duplicate.status, "review");
assert.deepEqual(duplicate.structure.duplicateElementIds, ["same"]);

const sensitive = analyze("unsafe.json", {
  api_key: "redacted",
  content: [],
});

assert.equal(sensitive.status, "blocked");
assert.deepEqual(sensitive.dependencies.sensitiveFieldNames, ["api_key"]);

const invalid = invalidTemplateAnalysis({
  fileName: "broken.json",
  sizeBytes: 4,
  checksum: "b".repeat(64),
  message: "Unexpected token",
});

assert.equal(invalid.status, "blocked");
assert.equal(invalid.format.family, "invalid-json");

console.log("template import analyzer tests passed");
