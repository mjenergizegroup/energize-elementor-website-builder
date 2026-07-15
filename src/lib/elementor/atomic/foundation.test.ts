import assert from "node:assert/strict";
import {
  createAtomicFoundation,
  createBrandedVariableValues,
} from "./foundation";
import { buildAtomicPage } from "./page-builder";
import { createAtomicStyleGuide } from "./style-guide";
import {
  createGlobalClassRepairPayload,
  findMissingGlobalClasses,
} from "./sync";

const foundation = createAtomicFoundation();
const variableIds = new Set(foundation.variables.map(({ id }) => id));
const classIds = new Set(foundation.classes.map(({ id }) => id));

assert.equal(foundation.variables.length >= 60, true);
assert.equal(foundation.variables.length <= 100, true);
assert.equal(foundation.classes.length >= 50, true);
assert.equal(foundation.classes.length <= 80, true);
assert.equal(variableIds.size, foundation.variables.length);
assert.equal(classIds.size, foundation.classes.length);

for (const variable of foundation.variables) {
  assert.match(variable.id, /^e-gv-[a-z0-9-]+$/);
  assert.match(variable.label, /^[a-zA-Z0-9_-]+$/);
  assert.equal(variable.label.length <= 50, true);
}

for (const size of ["xs", "s", "m", "l", "xl", "2xl", "3xl"]) {
  assert.equal(variableIds.has(`e-gv-space-${size}`), true);
  assert.equal(variableIds.has(`e-gv-text-${size}`), true);
  assert.equal(variableIds.has(`e-gv-radius-${size}`), true);
}

const serializedClasses = JSON.stringify(foundation.classes);
const references = serializedClasses.match(/e-gv-[a-z0-9-]+/g) ?? [];
for (const reference of references) {
  assert.equal(variableIds.has(reference), true, `Unknown variable ${reference}`);
}

const classLabels = new Set(foundation.classes.map(({ label }) => label));
assert.equal(classLabels.size, foundation.classes.length);
assert.equal(classLabels.has("container"), false);
assert.equal(classLabels.has("site-container"), true);

const importedClasses = foundation.classes.slice(0, -1).map(({ id, label }) => ({
  id,
  label,
}));
const missingClass = foundation.classes.at(-1);
assert.ok(missingClass);
assert.deepEqual(
  findMissingGlobalClasses(foundation.classes, importedClasses).map(({ id }) => id),
  [missingClass.id],
);
const classRepair = createGlobalClassRepairPayload(
  foundation.classes,
  importedClasses,
);
assert.deepEqual(classRepair.changes.added, [missingClass.id]);
assert.equal(classRepair.items[missingClass.id]?.label, missingClass.label);
assert.equal(classRepair.order.length, foundation.classes.length);
assert.equal(classRepair.order.at(-1), missingClass.id);

for (const component of foundation.components) {
  assert.match(component.uid, /^energize-[a-z0-9-]+$/);
  const serialized = JSON.stringify(component.elements);
  assert.equal(serialized.includes('"widgetType":"html"'), false);
  assert.equal(serialized.includes('"widgetType":"shortcode"'), false);
}

const branded = createBrandedVariableValues(
  {
    primary: "#123456",
    secondary: "#234567",
    accent: "#345678",
    text: "#111111",
    background: "#FFFFFF",
  },
  { heading: "Manrope", body: "Inter" },
);
assert.equal(branded["color-primary"], "#123456");
assert.equal(branded["font-body"], "Inter");
assert.match(branded["color-primary-20"], /^#[0-9A-F]{6}$/);

const page = buildAtomicPage({
  page: "homepage",
  title: "Home",
  practiceName: "Example Dental",
  preset: "elevate",
  pageData: {
    HERO: {
      HEADLINE: "Comfortable dentistry for your family",
      SUBHEADLINE: "A clear and welcoming introduction.",
    },
    SERVICES: {
      ITEMS: ["Preventive Care", "Cosmetic Dentistry", "Dental Implants"],
    },
  },
});
const pageJson = JSON.stringify(page.elementorData);
assert.equal(pageJson.includes('"elType":"section"'), false);
assert.equal(pageJson.includes('"widgetType":"heading"'), false);
assert.equal(pageJson.includes('"elType":"e-flexbox"'), true);
assert.equal(pageJson.includes('"widgetType":"e-heading"'), true);

const styleGuide = createAtomicStyleGuide();
const styleGuideJson = JSON.stringify(styleGuide);
assert.equal(styleGuideJson.includes('"elType":"e-flexbox"'), true);
assert.equal(styleGuideJson.includes('"widgetType":"e-heading"'), true);
assert.equal(styleGuideJson.includes('"widgetType":"html"'), false);
assert.equal(styleGuideJson.includes('"widgetType":"form"'), false);
assert.equal(styleGuideJson.includes('"$$type":"global-color-variable"'), true);
assert.equal((styleGuideJson.match(/"value":"h1"/g) ?? []).length, 1);

console.log(
  `Atomic foundation verified: ${foundation.variables.length} variables, ${foundation.classes.length} classes, ${foundation.components.length} components.`,
);
