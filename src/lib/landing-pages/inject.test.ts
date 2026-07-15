import assert from "node:assert/strict";
import Module from "node:module";

type ModuleWithLoader = typeof Module & {
  _load: (
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
  ) => unknown;
};

const moduleWithLoader = Module as ModuleWithLoader;
const originalLoad = moduleWithLoader._load;
moduleWithLoader._load = function loadWithServerOnlyStub(
  request,
  parent,
  isMain,
) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

type NodeRecord = Record<string, unknown>;

async function main(): Promise<void> {
  const {
    injectLandingPage,
    LANDING_PAGE_TEMPLATES,
  } = await import("./inject");

  for (const template of LANDING_PAGE_TEMPLATES) {
    const result = injectLandingPage(
      template,
      {
        HERO_HEADING: "Comfortable dentistry starts here",
        HERO_BODY: "A focused landing page built with Elementor Atomic elements.",
        PHONE: "(555) 123-4567",
      },
      { practiceName: "BiteSize Dentistry" },
    );
    const serialized = JSON.stringify(result.data);
    assert.equal(serialized.includes('"elType":"e-flexbox"'), true);
    assert.equal(serialized.includes('"widgetType":"e-heading"'), true);
    assert.equal(serialized.includes('"widgetType":"heading"'), false);
    assert.equal(serialized.includes('"elType":"container"'), false);
    assert.equal(serialized.includes("BiteSize Dentistry"), true);
    assert.equal(result.data.version, "4.1.1");
  }

  const aliases = injectLandingPage(
    "std_v1",
    {
      GOOGLE_BUSINESS_PROFILE_URL: "https://maps.app.goo.gl/example",
      business_hours: {
        monday: "9 AM - 5 PM",
        friday: { closed: true },
      },
      phone: "(555) 123-4567",
      FORM_HTML:
        '<iframe src="https://api.leadconnectorhq.com/widget/form/example"></iframe>',
    },
    { practiceName: "BiteSize Dentistry" },
  );

  assert(!aliases.missingSlots.includes("MAPS_ADDRESS"));
  assert(!aliases.missingSlots.includes("WORK_HOURS"));
  assert(!aliases.missingSlots.includes("PHONE_NUMBER"));

  const nodes = collectNodes(aliases.data);
  const classicWidgets = nodes.filter(
    (node) =>
      node.elType === "widget" &&
      typeof node.widgetType === "string" &&
      !node.widgetType.startsWith("e-"),
  );
  assert(
    classicWidgets.every((node) =>
      ["html", "shortcode", "google_maps"].includes(String(node.widgetType)),
    ),
  );
  assert(classicWidgets.some((node) => node.widgetType === "google_maps"));
  assert(classicWidgets.some((node) => node.widgetType === "html"));

  console.log("Atomic landing page injection checks passed");
}

function collectNodes(value: unknown): NodeRecord[] {
  const nodes: NodeRecord[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isObject(node)) return;
    if (typeof node.elType === "string") nodes.push(node);
    if (Array.isArray(node.elements)) node.elements.forEach(visit);
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(value);
  return nodes;
}

function isObject(value: unknown): value is NodeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
