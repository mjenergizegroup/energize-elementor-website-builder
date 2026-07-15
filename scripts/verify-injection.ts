import { buildAtomicPage } from "../src/lib/elementor/atomic/page-builder";

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
}

for (const preset of ["elevate", "summit", "lux"] as const) {
  console.log(`\nVerifying ${preset} Atomic website output:`);
  const result = buildAtomicPage({
    page: "homepage",
    title: "Home",
    practiceName: "Maple Street Dental",
    preset,
    site: { appointment_url: "https://example.com/appointment" },
    pageData: {
      HERO: {
        HEADLINE: "Modern dentistry for the whole family",
        BODY: "A welcoming introduction for Maple Street Dental.",
      },
      SERVICES: {
        ITEMS: [
          { name: "Preventive Care", description: "Protect long-term health." },
          { name: "Cosmetic Dentistry", description: "Feel confident smiling." },
          { name: "Dental Implants", description: "Restore comfort and function." },
        ],
      },
      CONTACT: {
        MAP_ADDRESS: "123 Main Street, Denver, CO",
        FORM_HTML:
          '<iframe src="https://api.leadconnectorhq.com/widget/form/example"></iframe>',
      },
    },
  });

  const serialized = JSON.stringify(result.elementorData);
  const ids = collectIds(result.elementorData);
  const classicWidgetTypes = collectClassicWidgetTypes(result.elementorData);

  check("uses Elementor V4 as the minimum document version", result.elementorVersion === "4.1.1");
  check("all element IDs are 8-character hex", ids.every((id) => /^[0-9a-f]{8}$/.test(id)));
  check("element IDs are unique", ids.length === new Set(ids).size);
  check("uses Atomic flexbox layout", serialized.includes('"elType":"e-flexbox"'));
  check("uses Atomic headings", serialized.includes('"widgetType":"e-heading"'));
  check("uses typed global classes", serialized.includes('"$$type":"classes"'));
  check("does not use classic sections", !serialized.includes('"elType":"section"'));
  check("does not use classic containers", !serialized.includes('"elType":"container"'));
  check(
    "classic widgets are isolated embed exceptions",
    classicWidgetTypes.every((type) => ["html", "shortcode", "google_maps"].includes(type)),
    classicWidgetTypes.join(", "),
  );
  check("records embed exceptions", result.legacyExceptions.length === 2);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

function collectIds(value: unknown): string[] {
  const ids: string[] = [];
  visit(value, (node) => {
    if (typeof node.id === "string") ids.push(node.id);
  });
  return ids;
}

function collectClassicWidgetTypes(value: unknown): string[] {
  const types: string[] = [];
  visit(value, (node) => {
    if (
      node.elType === "widget" &&
      typeof node.widgetType === "string" &&
      !node.widgetType.startsWith("e-")
    ) {
      types.push(node.widgetType);
    }
  });
  return types;
}

function visit(
  value: unknown,
  visitor: (node: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, visitor));
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (typeof node.elType === "string") visitor(node);
  if (Array.isArray(node.elements)) node.elements.forEach((item) => visit(item, visitor));
  if (Array.isArray(node.content)) node.content.forEach((item) => visit(item, visitor));
}
