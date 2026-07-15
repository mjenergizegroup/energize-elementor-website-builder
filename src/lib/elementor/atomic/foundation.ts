import type { BrandColors, BrandFonts } from "@/lib/types";
import {
  backgroundProp,
  boxShadowProp,
  colorVariable,
  desktop,
  dimensionsProp,
  fontVariable,
  mobile,
  sizeProp,
  sizeVariable,
  stringProp,
  tablet,
} from "./props";
import type {
  AtomicFoundation,
  AtomicGlobalClass,
  AtomicVariable,
  AtomicVariableType,
} from "./types";
import { button, flexbox, heading, paragraph } from "./elements";

export const ATOMIC_FOUNDATION_VERSION = "1.0.0";
export const MINIMUM_ELEMENTOR_VERSION = "4.1.1";

export const VARIABLE_IDS = {
  colorPrimary: "e-gv-color-primary",
  colorSecondary: "e-gv-color-secondary",
  colorAccent: "e-gv-color-accent",
  colorText: "e-gv-color-text",
  colorBackground: "e-gv-color-background",
  colorSurface: "e-gv-color-surface",
  colorWhite: "e-gv-color-white",
  colorBlack: "e-gv-color-black",
  fontHeading: "e-gv-font-heading",
  fontBody: "e-gv-font-body",
} as const;

export const CLASS_IDS = {
  site: "e-gc-site",
  section: "e-gc-section",
  sectionCompact: "e-gc-section-compact",
  sectionSpacious: "e-gc-section-spacious",
  sectionSurface: "e-gc-section-surface",
  sectionPrimary: "e-gc-section-primary",
  sectionDark: "e-gc-section-dark",
  container: "e-gc-container",
  containerNarrow: "e-gc-container-narrow",
  stack: "e-gc-stack",
  stackS: "e-gc-stack-s",
  stackL: "e-gc-stack-l",
  cluster: "e-gc-cluster",
  clusterCenter: "e-gc-cluster-center",
  clusterBetween: "e-gc-cluster-between",
  grid2: "e-gc-grid-2",
  grid3: "e-gc-grid-3",
  grid4: "e-gc-grid-4",
  grid6: "e-gc-grid-6",
  h1: "e-gc-h1",
  h2: "e-gc-h2",
  h3: "e-gc-h3",
  h4: "e-gc-h4",
  h5: "e-gc-h5",
  h6: "e-gc-h6",
  body: "e-gc-body",
  bodyL: "e-gc-body-l",
  small: "e-gc-small",
  eyebrow: "e-gc-eyebrow",
  lead: "e-gc-lead",
  link: "e-gc-link",
  blockquote: "e-gc-blockquote",
  list: "e-gc-list",
  textCenter: "e-gc-text-center",
  textInverse: "e-gc-text-inverse",
  button: "e-gc-button",
  buttonPrimary: "e-gc-button-primary",
  buttonSecondary: "e-gc-button-secondary",
  buttonAccent: "e-gc-button-accent",
  buttonOutline: "e-gc-button-outline",
  buttonGhost: "e-gc-button-ghost",
  buttonS: "e-gc-button-s",
  buttonL: "e-gc-button-l",
  buttonFull: "e-gc-button-full",
  card: "e-gc-card",
  cardFeature: "e-gc-card-feature",
  cardService: "e-gc-card-service",
  cardTeam: "e-gc-card-team",
  cardReview: "e-gc-card-review",
  media: "e-gc-media",
  mediaSquare: "e-gc-media-square",
  mediaPortrait: "e-gc-media-portrait",
  divider: "e-gc-divider",
  badge: "e-gc-badge",
  chip: "e-gc-chip",
  swatch: "e-gc-swatch",
  icon: "e-gc-icon",
  radiusS: "e-gc-radius-s",
  radiusM: "e-gc-radius-m",
  radiusL: "e-gc-radius-l",
  radiusPill: "e-gc-radius-pill",
  shadowS: "e-gc-shadow-s",
  shadowM: "e-gc-shadow-m",
  shadowL: "e-gc-shadow-l",
  hideMobile: "e-gc-hide-mobile",
  fullWidth: "e-gc-full-width",
} as const;

type VariableSeed = Omit<AtomicVariable, "order">;

const color = (label: string, value: string): VariableSeed => ({
  id: `e-gv-${label}`,
  type: "global-color-variable",
  label,
  value,
});

const font = (label: string, value: string): VariableSeed => ({
  id: `e-gv-${label}`,
  type: "global-font-variable",
  label,
  value,
});

const size = (label: string, value: string): VariableSeed => ({
  id: `e-gv-${label}`,
  type: "global-size-variable",
  label,
  value,
});

const COLOR_SEEDS: VariableSeed[] = [
  color("color-primary", "#1F5E6A"),
  color("color-primary-80", "#4C7E87"),
  color("color-primary-60", "#799EA6"),
  color("color-primary-40", "#A5BEC3"),
  color("color-primary-20", "#D2DFE1"),
  color("color-secondary", "#17324D"),
  color("color-secondary-80", "#455B70"),
  color("color-secondary-60", "#748493"),
  color("color-secondary-40", "#A2ADB8"),
  color("color-secondary-20", "#D1D6DB"),
  color("color-accent", "#D9A441"),
  color("color-accent-80", "#E1B667"),
  color("color-accent-60", "#E8C88D"),
  color("color-accent-40", "#F0DBB3"),
  color("color-accent-20", "#F7EDD9"),
  color("color-text", "#24313A"),
  color("color-background", "#FFFFFF"),
  color("color-surface", "#F4F7F8"),
  color("color-neutral-950", "#11181C"),
  color("color-neutral-900", "#1B252B"),
  color("color-neutral-800", "#2B3941"),
  color("color-neutral-700", "#3F4E57"),
  color("color-neutral-600", "#5A6972"),
  color("color-neutral-500", "#74828A"),
  color("color-neutral-400", "#9AA5AB"),
  color("color-neutral-300", "#BEC6CA"),
  color("color-neutral-200", "#DCE1E3"),
  color("color-neutral-100", "#EEF1F2"),
  color("color-neutral-50", "#F8F9FA"),
  color("color-white", "#FFFFFF"),
  color("color-black", "#000000"),
  color("color-success", "#247A4A"),
  color("color-warning", "#A86600"),
  color("color-error", "#B3261E"),
  color("color-info", "#1769AA"),
];

const SIZE_SEEDS: VariableSeed[] = [
  size("space-none", "0px"),
  size("space-xs", "4px"),
  size("space-s", "8px"),
  size("space-m", "16px"),
  size("space-l", "24px"),
  size("space-xl", "32px"),
  size("space-2xl", "48px"),
  size("space-3xl", "64px"),
  size("text-xs", "12px"),
  size("text-s", "14px"),
  size("text-m", "16px"),
  size("text-l", "18px"),
  size("text-xl", "22px"),
  size("text-2xl", "32px"),
  size("text-3xl", "48px"),
  size("radius-xs", "4px"),
  size("radius-s", "8px"),
  size("radius-m", "12px"),
  size("radius-l", "18px"),
  size("radius-xl", "24px"),
  size("radius-2xl", "32px"),
  size("radius-3xl", "999px"),
  size("border-s", "1px"),
  size("border-m", "2px"),
  size("border-l", "4px"),
  size("container-s", "720px"),
  size("container-m", "960px"),
  size("container-l", "1200px"),
  size("container-xl", "1320px"),
  size("icon-xs", "14px"),
  size("icon-s", "18px"),
  size("icon-m", "24px"),
  size("icon-l", "32px"),
  size("icon-xl", "48px"),
  size("section-y", "96px"),
  size("section-y-tablet", "72px"),
  size("section-y-mobile", "56px"),
  size("container-x", "24px"),
  size("container-x-mobile", "16px"),
];

const FONT_SEEDS: VariableSeed[] = [
  font("font-heading", "Manrope"),
  font("font-body", "Inter"),
];

function variables(): AtomicVariable[] {
  return [...COLOR_SEEDS, ...FONT_SEEDS, ...SIZE_SEEDS].map((item, index) => ({
    ...item,
    order: index + 1,
  }));
}

function classItem(
  id: string,
  label: string,
  variants: AtomicGlobalClass["variants"],
): AtomicGlobalClass {
  return { id, type: "class", label, variants };
}

const cv = (label: string) => colorVariable(`e-gv-${label}`);
const fv = (label: string) => fontVariable(`e-gv-${label}`);
const sv = (label: string) => sizeVariable(`e-gv-${label}`);

function headingClass(
  id: string,
  label: string,
  desktopSize: string,
  tabletSize: string,
  mobileSize: string,
  weight: string,
): AtomicGlobalClass {
  return classItem(id, label, [
    desktop({
      "font-family": fv("font-heading"),
      "font-size": sv(desktopSize),
      "font-weight": stringProp(weight),
      "line-height": sizeProp(1.12, "em"),
      color: cv("color-secondary"),
      margin: sv("space-none"),
    }),
    tablet({ "font-size": sv(tabletSize) }),
    mobile({ "font-size": sv(mobileSize) }),
  ]);
}

function classes(): AtomicGlobalClass[] {
  const zero = sv("space-none");
  const auto = sizeProp("", "auto");
  const full = sizeProp(100, "%");
  const border = sv("border-s");
  const cardPadding = dimensionsProp(sv("space-xl"));

  return [
    classItem(CLASS_IDS.site, "site", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("column"),
        width: full,
        padding: zero,
        background: backgroundProp(cv("color-background")),
        color: cv("color-text"),
        "font-family": fv("font-body"),
      }),
    ]),
    classItem(CLASS_IDS.section, "section", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("column"),
        "align-items": stringProp("center"),
        width: full,
        padding: dimensionsProp(
          sv("section-y"),
          sv("container-x"),
          sv("section-y"),
          sv("container-x"),
        ),
      }),
      tablet({
        padding: dimensionsProp(
          sv("section-y-tablet"),
          sv("container-x"),
          sv("section-y-tablet"),
          sv("container-x"),
        ),
      }),
      mobile({
        padding: dimensionsProp(
          sv("section-y-mobile"),
          sv("container-x-mobile"),
          sv("section-y-mobile"),
          sv("container-x-mobile"),
        ),
      }),
    ]),
    classItem(CLASS_IDS.sectionCompact, "section-compact", [
      desktop({ padding: dimensionsProp(sv("space-2xl"), sv("container-x")) }),
      mobile({
        padding: dimensionsProp(sv("space-xl"), sv("container-x-mobile")),
      }),
    ]),
    classItem(CLASS_IDS.sectionSpacious, "section-spacious", [
      desktop({ padding: dimensionsProp(sv("space-3xl"), sv("container-x")) }),
      mobile({
        padding: dimensionsProp(sv("space-2xl"), sv("container-x-mobile")),
      }),
    ]),
    classItem(CLASS_IDS.sectionSurface, "section-surface", [
      desktop({ background: backgroundProp(cv("color-surface")) }),
    ]),
    classItem(CLASS_IDS.sectionPrimary, "section-primary", [
      desktop({
        background: backgroundProp(cv("color-primary")),
        color: cv("color-white"),
      }),
    ]),
    classItem(CLASS_IDS.sectionDark, "section-dark", [
      desktop({
        background: backgroundProp(cv("color-secondary")),
        color: cv("color-white"),
      }),
    ]),
    classItem(CLASS_IDS.container, "site-container", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("column"),
        width: full,
        "max-width": sv("container-l"),
        gap: sv("space-l"),
        margin: dimensionsProp(zero, auto, zero, auto),
        padding: zero,
      }),
    ]),
    classItem(CLASS_IDS.containerNarrow, "container-narrow", [
      desktop({ "max-width": sv("container-s") }),
    ]),
    classItem(CLASS_IDS.stack, "stack", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("column"),
        gap: sv("space-m"),
        padding: zero,
      }),
    ]),
    classItem(CLASS_IDS.stackS, "stack-s", [desktop({ gap: sv("space-s") })]),
    classItem(CLASS_IDS.stackL, "stack-l", [desktop({ gap: sv("space-xl") })]),
    classItem(CLASS_IDS.cluster, "cluster", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("row"),
        "align-items": stringProp("center"),
        "flex-wrap": stringProp("wrap"),
        gap: sv("space-m"),
        padding: zero,
      }),
    ]),
    classItem(CLASS_IDS.clusterCenter, "cluster-center", [
      desktop({ "justify-content": stringProp("center") }),
    ]),
    classItem(CLASS_IDS.clusterBetween, "cluster-between", [
      desktop({ "justify-content": stringProp("space-between") }),
    ]),
    ...([2, 3, 4] as const).map((count) =>
      classItem(CLASS_IDS[`grid${count}`], `grid-${count}`, [
        desktop({
          display: stringProp("grid"),
          "grid-template-columns": stringProp(`repeat(${count}, minmax(0, 1fr))`),
          gap: sv("space-l"),
          padding: zero,
        }),
        tablet({
          "grid-template-columns": stringProp("repeat(2, minmax(0, 1fr))"),
        }),
        mobile({ "grid-template-columns": stringProp("minmax(0, 1fr)") }),
      ]),
    ),
    classItem(CLASS_IDS.grid6, "grid-6", [
      desktop({
        display: stringProp("grid"),
        "grid-template-columns": stringProp("repeat(6, minmax(0, 1fr))"),
        gap: sv("space-m"),
        padding: zero,
      }),
      tablet({ "grid-template-columns": stringProp("repeat(3, minmax(0, 1fr))") }),
      mobile({ "grid-template-columns": stringProp("repeat(2, minmax(0, 1fr))") }),
    ]),
    headingClass(CLASS_IDS.h1, "h1", "text-3xl", "text-2xl", "text-2xl", "700"),
    headingClass(CLASS_IDS.h2, "h2", "text-2xl", "text-2xl", "text-xl", "700"),
    headingClass(CLASS_IDS.h3, "h3", "text-xl", "text-xl", "text-l", "700"),
    headingClass(CLASS_IDS.h4, "h4", "text-l", "text-l", "text-m", "700"),
    headingClass(CLASS_IDS.h5, "h5", "text-m", "text-m", "text-s", "700"),
    headingClass(CLASS_IDS.h6, "h6", "text-s", "text-s", "text-xs", "700"),
    classItem(CLASS_IDS.body, "body", [
      desktop({
        "font-family": fv("font-body"),
        "font-size": sv("text-m"),
        "font-weight": stringProp("400"),
        "line-height": sizeProp(1.65, "em"),
        color: cv("color-text"),
        margin: zero,
      }),
    ]),
    classItem(CLASS_IDS.bodyL, "body-l", [desktop({ "font-size": sv("text-l") })]),
    classItem(CLASS_IDS.small, "small", [
      desktop({ "font-size": sv("text-s"), "line-height": sizeProp(1.5, "em") }),
    ]),
    classItem(CLASS_IDS.eyebrow, "eyebrow", [
      desktop({
        "font-family": fv("font-body"),
        "font-size": sv("text-xs"),
        "font-weight": stringProp("700"),
        "letter-spacing": sizeProp(0.12, "em"),
        "text-transform": stringProp("uppercase"),
        color: cv("color-primary"),
        margin: zero,
      }),
    ]),
    classItem(CLASS_IDS.lead, "lead", [
      desktop({
        "font-size": sv("text-l"),
        "line-height": sizeProp(1.6, "em"),
        color: cv("color-neutral-700"),
      }),
    ]),
    classItem(CLASS_IDS.link, "link", [
      desktop({
        color: cv("color-primary"),
        "text-decoration": stringProp("underline"),
        cursor: stringProp("pointer"),
      }),
      desktop({ color: cv("color-primary-80") }, "hover"),
    ]),
    classItem(CLASS_IDS.blockquote, "blockquote", [
      desktop({
        padding: dimensionsProp(sv("space-l")),
        "border-width": sv("border-m"),
        "border-style": stringProp("solid"),
        "border-color": cv("color-accent"),
        "font-style": stringProp("italic"),
        "font-size": sv("text-l"),
      }),
    ]),
    classItem(CLASS_IDS.list, "list", [
      desktop({
        "font-family": fv("font-body"),
        "font-size": sv("text-m"),
        "line-height": sizeProp(1.65, "em"),
        color: cv("color-text"),
      }),
    ]),
    classItem(CLASS_IDS.textCenter, "text-center", [desktop({ "text-align": stringProp("center") })]),
    classItem(CLASS_IDS.textInverse, "text-inverse", [desktop({ color: cv("color-white") })]),
    classItem(CLASS_IDS.button, "button", [
      desktop({
        display: stringProp("inline-flex"),
        "align-items": stringProp("center"),
        "justify-content": stringProp("center"),
        gap: sv("space-s"),
        padding: dimensionsProp(sv("space-m"), sv("space-l")),
        "border-radius": sv("radius-s"),
        "border-width": border,
        "border-style": stringProp("solid"),
        "font-family": fv("font-body"),
        "font-size": sv("text-m"),
        "font-weight": stringProp("700"),
        "line-height": sizeProp(1.2, "em"),
        "text-decoration": stringProp("none"),
        cursor: stringProp("pointer"),
      }),
    ]),
    classItem(CLASS_IDS.buttonPrimary, "button-primary", [
      desktop({
        background: backgroundProp(cv("color-primary")),
        color: cv("color-white"),
        "border-color": cv("color-primary"),
      }),
      desktop(
        {
          background: backgroundProp(cv("color-primary-80")),
          "border-color": cv("color-primary-80"),
        },
        "hover",
      ),
    ]),
    classItem(CLASS_IDS.buttonSecondary, "button-secondary", [
      desktop({
        background: backgroundProp(cv("color-secondary")),
        color: cv("color-white"),
        "border-color": cv("color-secondary"),
      }),
    ]),
    classItem(CLASS_IDS.buttonAccent, "button-accent", [
      desktop({
        background: backgroundProp(cv("color-accent")),
        color: cv("color-neutral-950"),
        "border-color": cv("color-accent"),
      }),
    ]),
    classItem(CLASS_IDS.buttonOutline, "button-outline", [
      desktop({
        background: backgroundProp(cv("color-background")),
        color: cv("color-primary"),
        "border-color": cv("color-primary"),
      }),
    ]),
    classItem(CLASS_IDS.buttonGhost, "button-ghost", [
      desktop({
        background: backgroundProp(cv("color-background")),
        color: cv("color-primary"),
        "border-color": cv("color-background"),
        padding: dimensionsProp(sv("space-s"), sv("space-xs")),
      }),
    ]),
    classItem(CLASS_IDS.buttonS, "button-s", [
      desktop({
        padding: dimensionsProp(sv("space-s"), sv("space-m")),
        "font-size": sv("text-s"),
      }),
    ]),
    classItem(CLASS_IDS.buttonL, "button-l", [
      desktop({
        padding: dimensionsProp(sv("space-l"), sv("space-xl")),
        "font-size": sv("text-l"),
      }),
    ]),
    classItem(CLASS_IDS.buttonFull, "button-full", [desktop({ width: full })]),
    classItem(CLASS_IDS.card, "card", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("column"),
        gap: sv("space-m"),
        height: full,
        padding: cardPadding,
        background: backgroundProp(cv("color-background")),
        "border-width": border,
        "border-style": stringProp("solid"),
        "border-color": cv("color-neutral-200"),
        "border-radius": sv("radius-m"),
      }),
      mobile({ padding: dimensionsProp(sv("space-l")) }),
    ]),
    classItem(CLASS_IDS.cardFeature, "card-feature", [
      desktop({ background: backgroundProp(cv("color-surface")) }),
    ]),
    classItem(CLASS_IDS.cardService, "card-service", [
      desktop({ background: backgroundProp(cv("color-primary-20")) }),
    ]),
    classItem(CLASS_IDS.cardTeam, "card-team", [desktop({ "text-align": stringProp("center") })]),
    classItem(CLASS_IDS.cardReview, "card-review", [desktop({ "border-color": cv("color-accent-40") })]),
    classItem(CLASS_IDS.media, "media", [
      desktop({ width: full, "object-fit": stringProp("cover"), "border-radius": sv("radius-m") }),
    ]),
    classItem(CLASS_IDS.mediaSquare, "media-square", [desktop({ "aspect-ratio": stringProp("1 / 1") })]),
    classItem(CLASS_IDS.mediaPortrait, "media-portrait", [desktop({ "aspect-ratio": stringProp("4 / 5") })]),
    classItem(CLASS_IDS.divider, "divider", [
      desktop({ width: full, height: sv("border-s"), background: backgroundProp(cv("color-neutral-200")) }),
    ]),
    classItem(CLASS_IDS.badge, "badge", [
      desktop({
        display: stringProp("inline-flex"),
        padding: dimensionsProp(sv("space-xs"), sv("space-s")),
        background: backgroundProp(cv("color-primary-20")),
        color: cv("color-primary"),
        "border-radius": sv("radius-3xl"),
        "font-size": sv("text-xs"),
        "font-weight": stringProp("700"),
      }),
    ]),
    classItem(CLASS_IDS.chip, "chip", [
      desktop({
        display: stringProp("inline-flex"),
        padding: dimensionsProp(sv("space-s"), sv("space-m")),
        background: backgroundProp(cv("color-neutral-100")),
        color: cv("color-neutral-800"),
        "border-radius": sv("radius-3xl"),
        "font-size": sv("text-s"),
        "font-weight": stringProp("700"),
      }),
    ]),
    classItem(CLASS_IDS.swatch, "swatch", [
      desktop({
        display: stringProp("flex"),
        "flex-direction": stringProp("column"),
        "justify-content": stringProp("end"),
        "min-height": sizeProp(120),
        padding: dimensionsProp(sv("space-m")),
        "border-radius": sv("radius-m"),
        "border-width": sv("border-s"),
        "border-style": stringProp("solid"),
        "border-color": cv("color-neutral-300"),
      }),
    ]),
    classItem(CLASS_IDS.icon, "icon", [desktop({ width: sv("icon-m"), height: sv("icon-m") })]),
    classItem(CLASS_IDS.radiusS, "radius-s", [desktop({ "border-radius": sv("radius-s") })]),
    classItem(CLASS_IDS.radiusM, "radius-m", [desktop({ "border-radius": sv("radius-m") })]),
    classItem(CLASS_IDS.radiusL, "radius-l", [desktop({ "border-radius": sv("radius-l") })]),
    classItem(CLASS_IDS.radiusPill, "radius-pill", [desktop({ "border-radius": sv("radius-3xl") })]),
    classItem(CLASS_IDS.shadowS, "shadow-s", [
      desktop({ "box-shadow": boxShadowProp(4, 14, "rgba(17, 24, 28, 0.08)") }),
    ]),
    classItem(CLASS_IDS.shadowM, "shadow-m", [
      desktop({ "box-shadow": boxShadowProp(12, 32, "rgba(17, 24, 28, 0.12)") }),
    ]),
    classItem(CLASS_IDS.shadowL, "shadow-l", [
      desktop({ "box-shadow": boxShadowProp(20, 48, "rgba(17, 24, 28, 0.16)") }),
    ]),
    classItem(CLASS_IDS.hideMobile, "hide-mobile", [mobile({ display: stringProp("none") })]),
    classItem(CLASS_IDS.fullWidth, "full-width", [desktop({ width: full })]),
  ];
}

function components() {
  return [
    {
      uid: "energize-button-primary",
      title: "Energize Button Primary",
      elements: [
        flexbox(
          [CLASS_IDS.cluster],
          [button("Schedule a Consultation", "#contact", [CLASS_IDS.button, CLASS_IDS.buttonPrimary])],
        ),
      ],
    },
    {
      uid: "energize-section-heading",
      title: "Energize Section Heading",
      elements: [
        flexbox(
          [CLASS_IDS.stack, CLASS_IDS.stackS],
          [
            paragraph("Expert dental care", [CLASS_IDS.eyebrow]),
            heading("A clear section heading", "h2", [CLASS_IDS.h2]),
            paragraph("Add concise supporting copy for this section.", [CLASS_IDS.body, CLASS_IDS.lead]),
          ],
        ),
      ],
    },
    {
      uid: "energize-service-card",
      title: "Energize Service Card",
      elements: [
        flexbox(
          [CLASS_IDS.card, CLASS_IDS.cardService],
          [
            heading("Service name", "h3", [CLASS_IDS.h3]),
            paragraph("Describe the patient benefit in one short paragraph.", [CLASS_IDS.body]),
            button("Learn More", "#", [CLASS_IDS.button, CLASS_IDS.buttonGhost]),
          ],
          "article",
        ),
      ],
    },
    {
      uid: "energize-review-card",
      title: "Energize Review Card",
      elements: [
        flexbox(
          [CLASS_IDS.card, CLASS_IDS.cardReview],
          [
            paragraph("Patient review text goes here.", [CLASS_IDS.body, CLASS_IDS.bodyL]),
            paragraph("Patient name", [CLASS_IDS.small]),
          ],
          "article",
        ),
      ],
    },
    {
      uid: "energize-team-card",
      title: "Energize Team Card",
      elements: [
        flexbox(
          [CLASS_IDS.card, CLASS_IDS.cardTeam],
          [
            flexbox(
              [CLASS_IDS.mediaSquare, CLASS_IDS.sectionSurface],
              [paragraph("Portrait image", [CLASS_IDS.small, CLASS_IDS.textCenter])],
            ),
            heading("Dr. Taylor Morgan", "h3", [CLASS_IDS.h3]),
            paragraph("General Dentist", [CLASS_IDS.eyebrow]),
            paragraph("Add a concise, patient-focused biography.", [CLASS_IDS.body]),
          ],
          "article",
        ),
      ],
    },
    {
      uid: "energize-hero-standard",
      title: "Energize Hero Standard",
      elements: [
        flexbox(
          [CLASS_IDS.section, CLASS_IDS.sectionSurface],
          [
            flexbox(
              [CLASS_IDS.container, CLASS_IDS.stack, CLASS_IDS.stackL],
              [
                paragraph("Trusted dental care", [CLASS_IDS.eyebrow]),
                heading("A healthier smile starts here", "h1", [CLASS_IDS.h1]),
                paragraph("Personalized care in a comfortable, modern office.", [CLASS_IDS.body, CLASS_IDS.lead]),
                flexbox(
                  [CLASS_IDS.cluster],
                  [
                    button("Book Appointment", "#contact", [CLASS_IDS.button, CLASS_IDS.buttonPrimary]),
                    button("Call Now", "tel:5551234567", [CLASS_IDS.button, CLASS_IDS.buttonOutline]),
                  ],
                ),
              ],
            ),
          ],
          "section",
        ),
      ],
    },
    {
      uid: "energize-feature-row",
      title: "Energize Feature Row",
      elements: [
        flexbox(
          [CLASS_IDS.grid3],
          ["Same-day visits", "Insurance friendly", "Gentle care"].map((title) =>
            flexbox(
              [CLASS_IDS.card, CLASS_IDS.cardFeature],
              [
                heading(title, "h3", [CLASS_IDS.h4]),
                paragraph("Add one clear patient benefit.", [CLASS_IDS.body]),
              ],
              "article",
            ),
          ),
        ),
      ],
    },
    {
      uid: "energize-before-after",
      title: "Energize Before After",
      elements: [
        flexbox(
          [CLASS_IDS.grid2],
          ["Before", "After"].map((label) =>
            flexbox(
              [CLASS_IDS.card, CLASS_IDS.sectionSurface],
              [
                paragraph(label, [CLASS_IDS.chip]),
                paragraph("Replace with a treatment image.", [CLASS_IDS.body]),
              ],
            ),
          ),
        ),
      ],
    },
    {
      uid: "energize-logo-strip",
      title: "Energize Logo Strip",
      elements: [
        flexbox(
          [CLASS_IDS.cluster, CLASS_IDS.clusterCenter, CLASS_IDS.sectionSurface],
          ["Insurance A", "Insurance B", "Insurance C", "Insurance D"].map((label) =>
            paragraph(label, [CLASS_IDS.chip]),
          ),
        ),
      ],
    },
    {
      uid: "energize-inline-cta",
      title: "Energize CTA Inline",
      elements: [
        flexbox(
          [CLASS_IDS.card, CLASS_IDS.cluster, CLASS_IDS.clusterBetween],
          [
            flexbox(
              [CLASS_IDS.stack, CLASS_IDS.stackS],
              [
                heading("Plan your next visit", "h3", [CLASS_IDS.h3]),
                paragraph("Call or book online when you are ready.", [CLASS_IDS.body]),
              ],
            ),
            flexbox(
              [CLASS_IDS.cluster],
              [
                button("Call Now", "tel:5551234567", [CLASS_IDS.button, CLASS_IDS.buttonOutline]),
                button("Book Online", "#contact", [CLASS_IDS.button, CLASS_IDS.buttonPrimary]),
              ],
            ),
          ],
        ),
      ],
    },
    {
      uid: "energize-stats-strip",
      title: "Energize Stats Strip",
      elements: [
        flexbox(
          [CLASS_IDS.grid3, CLASS_IDS.sectionSurface],
          [
            ["20+", "Years serving patients"],
            ["10k+", "Smiles cared for"],
            ["5 star", "Patient experience"],
          ].map(([value, label]) =>
            flexbox(
              [CLASS_IDS.stack, CLASS_IDS.stackS, CLASS_IDS.textCenter],
              [
                heading(value, "h3", [CLASS_IDS.h2]),
                paragraph(label, [CLASS_IDS.small]),
              ],
            ),
          ),
        ),
      ],
    },
    {
      uid: "energize-cta-band",
      title: "Energize CTA Band",
      elements: [
        flexbox(
          [CLASS_IDS.section, CLASS_IDS.sectionPrimary],
          [
            flexbox(
              [CLASS_IDS.container, CLASS_IDS.stack, CLASS_IDS.textCenter],
              [
                heading("Ready to feel confident about your smile?", "h2", [CLASS_IDS.h2, CLASS_IDS.textInverse]),
                paragraph("Talk with our team about the right next step.", [CLASS_IDS.body, CLASS_IDS.textInverse]),
                flexbox(
                  [CLASS_IDS.cluster, CLASS_IDS.clusterCenter],
                  [button("Schedule a Consultation", "#contact", [CLASS_IDS.button, CLASS_IDS.buttonAccent])],
                ),
              ],
            ),
          ],
          "section",
        ),
      ],
    },
  ];
}

export function createAtomicFoundation(): AtomicFoundation {
  return {
    name: "Energize Atomic Foundation",
    version: ATOMIC_FOUNDATION_VERSION,
    minimumElementorVersion: MINIMUM_ELEMENTOR_VERSION,
    variables: variables(),
    classes: classes(),
    components: components(),
  };
}

export function createBrandedVariableValues(
  colors: BrandColors,
  fonts: BrandFonts,
): Record<string, string> {
  const values: Record<string, string> = {
    "color-primary": colors.primary,
    "color-secondary": colors.secondary,
    "color-accent": colors.accent,
    "color-text": colors.text,
    "color-background": colors.background,
    "color-surface": colors.highlight ?? tintTowardWhite(colors.primary, 8),
    "font-heading": fonts.heading,
    "font-body": fonts.body,
  };

  for (const key of ["primary", "secondary", "accent"] as const) {
    for (const level of [80, 60, 40, 20] as const) {
      values[`color-${key}-${level}`] = tintTowardWhite(colors[key], level);
    }
  }

  return values;
}

export function foundationVariableByLabel(
  label: string,
): AtomicVariable | undefined {
  return createAtomicFoundation().variables.find((variable) => variable.label === label);
}

export function isVariableType(value: string): value is AtomicVariableType {
  return [
    "global-color-variable",
    "global-font-variable",
    "global-size-variable",
  ].includes(value);
}

function tintTowardWhite(hex: string, level: number): string {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid brand color: ${hex}`);
  }
  const value = Number.parseInt(normalized, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const mixed = channels.map((channel) =>
    Math.round(channel * (level / 100) + 255 * (1 - level / 100)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
