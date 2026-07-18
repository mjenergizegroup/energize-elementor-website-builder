import assert from "node:assert/strict";
import { buildLayoutPreview, previewFromThumbnail } from "./preview";

const fallback = {
  sectionCount: 2,
  headingSlots: 2,
  bodySlots: 2,
  imageSlots: 1,
  buttonSlots: 1,
};

const preview = buildLayoutPreview({
  fallback,
  artifact: {
    content: [
      {
        id: "hero",
        elType: "container",
        elements: [
          {
            id: "copy",
            elType: "container",
            elements: [
              { id: "heading", elType: "widget", elements: [] },
              { id: "body", elType: "widget", elements: [] },
            ],
          },
          {
            id: "visual",
            elType: "container",
            elements: [{ id: "image", elType: "widget", elements: [] }],
          },
        ],
      },
    ],
  },
  semanticSlots: [
    { id: "a", kind: "heading", nodeId: "heading", settingKey: "title", order: 0, repeatable: false },
    { id: "b", kind: "body", nodeId: "body", settingKey: "editor", order: 1, repeatable: false },
    { id: "c", kind: "image", nodeId: "image", settingKey: "image", order: 2, repeatable: false },
  ],
});

assert.equal(preview.sections.length, 1);
assert.deepEqual(preview.sections[0].regions[0].slots, ["heading", "body"]);
assert.deepEqual(preview.sections[0].regions[1].slots, ["image"]);

const fallbackPreview = previewFromThumbnail(fallback);
assert.equal(fallbackPreview.sections.length, 2);
assert.ok(fallbackPreview.sections[0].regions.some((region) => region.slots.includes("image")));

console.log("layout preview checks passed");
