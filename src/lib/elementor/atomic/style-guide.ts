import {
  backgroundProp,
  colorVariable,
  desktop,
  sizeProp,
  sizeVariable,
} from "./props";
import {
  divBlock,
  flexbox,
  heading,
  paragraph,
  button,
  withLocalStyle,
} from "./elements";
import { CLASS_IDS, createAtomicFoundation } from "./foundation";
import type { AtomicElement } from "./types";

export interface AtomicStyleGuideDocument {
  version: "0.4";
  title: string;
  type: "page";
  page_settings: Record<string, unknown>;
  content: AtomicElement[];
}

export function createAtomicStyleGuide(): AtomicStyleGuideDocument {
  const foundation = createAtomicFoundation();
  const colorVariables = foundation.variables.filter(
    ({ type }) => type === "global-color-variable",
  );
  const componentExamples = foundation.components.flatMap((component) => [
    paragraph(component.title, [CLASS_IDS.eyebrow]),
    ...component.elements.map((element) => demoteNestedH1(element)),
  ]);

  const page = flexbox(
    [CLASS_IDS.site],
    [
      styleGuideSection(
        "Energize Atomic Style Guide",
        "A live proof sheet for every shared variable, class, layout pattern, and dental component.",
        [
          paragraph("Default-site design system", [CLASS_IDS.eyebrow]),
          heading("Energize Atomic Style Guide", "h1", [CLASS_IDS.h1]),
          paragraph(
            "Use this page while reskinning a client. Changes to Atomic variables cascade through every example below.",
            [CLASS_IDS.body, CLASS_IDS.lead],
          ),
        ],
      ),
      styleGuideSection(
        "System map",
        "The compact naming contract used by websites and landing pages.",
        [
          flexbox(
            [CLASS_IDS.grid3],
            [
              legendCard("Variables", "color-*, font-*, space-*, text-*, radius-*, border-*, container-*, icon-*"),
              legendCard("Global classes", "section, container, stack, cluster, grid-*, h1-h6, button-*, card-*"),
              legendCard("Components", "Reusable dental patterns built from Atomic elements and the shared class system"),
            ],
          ),
        ],
        true,
      ),
      styleGuideSection(
        "Color system",
        "Every swatch is bound directly to its Elementor Color Variable.",
        [
          flexbox(
            [CLASS_IDS.grid6],
            colorVariables.map((variable) => colorSwatch(variable.label, variable.id)),
          ),
        ],
      ),
      styleGuideSection(
        "Typography scale",
        "Heading and paragraph roles use the shared font and t-shirt size variables.",
        [
          heading("Heading 2 - Section title", "h2", [CLASS_IDS.h2]),
          heading("Heading 3 - Content group", "h3", [CLASS_IDS.h3]),
          heading("Heading 4 - Card title", "h4", [CLASS_IDS.h4]),
          heading("Heading 5 - Supporting title", "h5", [CLASS_IDS.h5]),
          heading("Heading 6 - Small heading", "h6", [CLASS_IDS.h6]),
          paragraph("Lead paragraph for high-priority introductory copy.", [CLASS_IDS.body, CLASS_IDS.lead]),
          paragraph("Body paragraph for clear, readable dental content and patient education.", [CLASS_IDS.body]),
          paragraph("Small copy for captions, credentials, and disclaimers.", [CLASS_IDS.small]),
          paragraph("Styled inline link example", [CLASS_IDS.body, CLASS_IDS.link]),
          paragraph("Patient care should always feel clear, calm, and personal.", [CLASS_IDS.body, CLASS_IDS.blockquote]),
        ],
        true,
      ),
      styleGuideSection(
        "Buttons",
        "Use the button base class with one modifier. Hover states live on the modifier class.",
        [
          flexbox(
            [CLASS_IDS.cluster],
            [
              button("Book Appointment", "#", [CLASS_IDS.button, CLASS_IDS.buttonPrimary]),
              button("Our Services", "#", [CLASS_IDS.button, CLASS_IDS.buttonSecondary]),
              button("New Patient Special", "#", [CLASS_IDS.button, CLASS_IDS.buttonAccent]),
              button("Call the Practice", "tel:5551234567", [CLASS_IDS.button, CLASS_IDS.buttonOutline]),
              button("View Details", "#", [CLASS_IDS.button, CLASS_IDS.buttonGhost]),
            ],
          ),
        ],
      ),
      styleGuideSection(
        "Spacing and sizing",
        "The same xs through 3xl t-shirt scale drives spacing, typography, and radii.",
        [
          flexbox(
            [CLASS_IDS.stack],
            ["xs", "s", "m", "l", "xl", "2xl", "3xl"].map(spacingBar),
          ),
          flexbox(
            [CLASS_IDS.grid4],
            [
              sampleCard("radius-s", CLASS_IDS.radiusS),
              sampleCard("radius-m", CLASS_IDS.radiusM),
              sampleCard("radius-l", CLASS_IDS.radiusL),
              sampleCard("radius-3xl / pill", CLASS_IDS.radiusPill),
            ],
          ),
        ],
        true,
      ),
      styleGuideSection(
        "Elevation",
        "Shadows are class-based because Elementor supports only Color, Font, and Size variables.",
        [
          flexbox(
            [CLASS_IDS.grid3],
            [
              sampleCard("shadow-s", CLASS_IDS.shadowS),
              sampleCard("shadow-m", CLASS_IDS.shadowM),
              sampleCard("shadow-l", CLASS_IDS.shadowL),
            ],
          ),
        ],
      ),
      styleGuideSection(
        "Layout patterns",
        "Responsive two-column, three-column, stack, cluster, section, and container patterns.",
        [
          flexbox(
            [CLASS_IDS.grid2],
            [
              legendCard("Content column", "Use for headings, body copy, and actions."),
              legendCard("Media column", "Use for a doctor, office, or treatment image."),
            ],
          ),
          flexbox(
            [CLASS_IDS.grid3],
            [
              legendCard("Column one", "Stacks cleanly on mobile."),
              legendCard("Column two", "Shares the same responsive class."),
              legendCard("Column three", "No one-off layout values."),
            ],
          ),
        ],
        true,
      ),
      styleGuideSection(
        "Dental component library",
        "Live blueprints for the Atomic-only components seeded on the default site.",
        [flexbox([CLASS_IDS.stack, CLASS_IDS.stackL], componentExamples)],
      ),
      styleGuideSection(
        "Iconography guidance",
        "Use one SVG family, currentColor, consistent stroke weight, and the icon t-shirt variables. Icon-and-text buttons use an Atomic wrapper because the Atomic Button has no icon slot.",
        [
          flexbox(
            [CLASS_IDS.cluster],
            ["Calendar", "Phone", "Location", "Shield", "Smile"].map((label) =>
              paragraph(label, [CLASS_IDS.chip]),
            ),
          ),
        ],
        true,
      ),
    ],
  );

  return {
    version: "0.4",
    title: "Energize Atomic Style Guide",
    type: "page",
    page_settings: {},
    content: [page],
  };
}

function styleGuideSection(
  title: string,
  caption: string,
  content: AtomicElement[],
  surface = false,
): AtomicElement {
  return flexbox(
    [CLASS_IDS.section, ...(surface ? [CLASS_IDS.sectionSurface] : [])],
    [
      flexbox(
        [CLASS_IDS.container, CLASS_IDS.stack, CLASS_IDS.stackL],
        [
          flexbox(
            [CLASS_IDS.stack, CLASS_IDS.stackS],
            [
              heading(title, "h2", [CLASS_IDS.h2]),
              paragraph(caption, [CLASS_IDS.body, CLASS_IDS.lead]),
            ],
          ),
          ...content,
        ],
      ),
    ],
    "section",
  );
}

function legendCard(title: string, body: string): AtomicElement {
  return flexbox(
    [CLASS_IDS.card],
    [
      heading(title, "h3", [CLASS_IDS.h3]),
      paragraph(body, [CLASS_IDS.body]),
    ],
    "article",
  );
}

function colorSwatch(label: string, variableId: string): AtomicElement {
  const swatch = withLocalStyle(
    divBlock([CLASS_IDS.swatch]),
    [desktop({ background: backgroundProp(colorVariable(variableId)) })],
  );
  return flexbox(
    [CLASS_IDS.stack, CLASS_IDS.stackS],
    [swatch, paragraph(label, [CLASS_IDS.small])],
  );
}

function spacingBar(size: string): AtomicElement {
  const bar = withLocalStyle(
    divBlock([CLASS_IDS.radiusS]),
    [
      desktop({
        width: sizeVariable(`e-gv-space-${size}`),
        height: sizeProp(20),
        background: backgroundProp(colorVariable("e-gv-color-primary")),
      }),
    ],
  );
  return flexbox(
    [CLASS_IDS.cluster],
    [paragraph(`space-${size}`, [CLASS_IDS.small]), bar],
  );
}

function sampleCard(label: string, classId: string): AtomicElement {
  return flexbox(
    [CLASS_IDS.card, classId],
    [
      paragraph(label, [CLASS_IDS.eyebrow]),
      paragraph("Reusable class sample", [CLASS_IDS.body]),
    ],
  );
}

function demoteNestedH1(element: AtomicElement): AtomicElement {
  const clone = structuredClone(element);
  const walk = (node: AtomicElement): void => {
    const tag = node.settings.tag;
    if (
      tag &&
      typeof tag === "object" &&
      "$$type" in tag &&
      "value" in tag &&
      tag.value === "h1"
    ) {
      tag.value = "h3";
    }
    node.elements.forEach(walk);
  };
  walk(clone);
  return clone;
}
