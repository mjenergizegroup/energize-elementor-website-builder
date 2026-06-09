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

const brandColors = {
  primary: "#AD9614",
  secondary: "#566169",
  accent: "#F7941D",
  text: "#AD9614",
  background: "#F8F5EA",
};

function findNode(node: unknown, id: string): NodeRecord | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNode(item, id);
      if (found) return found;
    }
    return null;
  }

  if (!isObject(node)) return null;
  if (node.id === id) return node;

  for (const value of Object.values(node)) {
    const found = findNode(value, id);
    if (found) return found;
  }

  return null;
}

function isObject(value: unknown): value is NodeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function settingsFor(data: unknown, id: string): NodeRecord {
  const node = findNode(data, id);
  assert(node);
  assert(isObject(node.settings));
  return node.settings;
}

async function main(): Promise<void> {
  const { injectLandingPage } = await import("./inject");

  const standard = injectLandingPage(
    "std_v1",
    {
      HERO_HEADING: "Join Our Membership Plan From $33.25/Month",
      MAPS_ADDRESS: "1195 N Fayette St, Alexandria, VA 22314",
    },
    {
      brandColors,
      practiceName: "Prewitt Dental Ranchos",
    },
  );

  const heroHeading = settingsFor(standard.data, "dbe8420");
  assert.equal(heroHeading.title_color, "#111111");
  assert(
    !("__globals__" in heroHeading) ||
      !isObject(heroHeading.__globals__) ||
      !("title_color" in heroHeading.__globals__),
  );

  const map = settingsFor(standard.data, "a2948d5");
  assert.equal(
    map.address,
    "Prewitt Dental Ranchos 1195 N Fayette St, Alexandria, VA 22314",
  );

  const standardV2 = injectLandingPage(
    "std_v2",
    {},
    {
      brandColors,
      practiceName: "Prewitt Dental Ranchos",
    },
  );

  const cta = settingsFor(standardV2.data, "10a65223");
  assert.equal(cta.text, "Free Consultation");

  console.log("landing page injection checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
