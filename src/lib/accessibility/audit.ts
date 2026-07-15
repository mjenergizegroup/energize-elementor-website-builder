import type { BrandColors } from "@/lib/types";

type ElementorNode = Record<string, unknown>;
type AuditContentPage = {
  page: string;
  slug?: string;
  slots?: unknown;
  pageData?: unknown;
};

type AuditContent = {
  practiceName: string;
  site?: Record<string, string>;
  pages: AuditContentPage[];
};

export type AccessibilitySeverity = "pass" | "warning" | "fail" | "manual";

export interface AccessibilityIssue {
  id: string;
  severity: AccessibilitySeverity;
  rule: string;
  page?: string;
  message: string;
  guidance?: string;
}

export interface AccessibilityReport {
  target: "WCAG 2.2 AA";
  summary: {
    pass: number;
    warning: number;
    fail: number;
    manual: number;
  };
  launchReady: boolean;
  issues: AccessibilityIssue[];
  checkedAt: string;
}

export interface AccessibilityPageInput {
  page: string;
  title: string;
  elementorData: unknown[];
}

interface HeadingRef {
  id: string;
  level: string;
  text: string;
  settings: ElementorNode;
  field: string;
}

const VAGUE_LINK_TEXT = new Set([
  "click here",
  "learn more",
  "read more",
  "more",
  "details",
]);

const HEADING_ORDER = ["h1", "h2", "h3", "h4", "h5", "h6"];

export function createAccessibilityReport(input: {
  content: AuditContent;
  colors: BrandColors;
  pages: AccessibilityPageInput[];
  statementHandledByPlugin: boolean;
}): AccessibilityReport {
  const issues: AccessibilityIssue[] = [
    ...auditBrandColors(input.colors),
    ...auditContent(input.content),
  ];

  for (const page of input.pages) {
    issues.push(...auditElementorPage(page));
  }

  if (input.statementHandledByPlugin) {
    issues.push({
      id: "accessibility-statement-plugin-managed",
      severity: "pass",
      rule: "Accessibility Statement",
      page: "accessibility-statement",
      message: "The Accessibility Statement is handled by the WordPress plugin.",
    });
  } else {
    issues.push({
      id: "accessibility-statement-missing",
      severity: "fail",
      rule: "Accessibility Statement",
      page: "accessibility-statement",
      message: "The build did not create an Accessibility Statement page.",
      guidance: "Create a native HTML statement page before launch.",
    });
  }

  issues.push({
    id: "footer-link-manual-check",
    severity: "manual",
    rule: "Footer Accessibility Statement Link",
    message: "Confirm the footer links to the Accessibility Statement before launch.",
    guidance:
      "Footer structure is controlled by the active WordPress theme, so this must be verified in WordPress after draft review.",
  });

  issues.push({
    id: "keyboard-manual-check",
    severity: "manual",
    rule: "Keyboard Navigation",
    message: "Keyboard navigation and focus order require browser QA before launch.",
    guidance:
      "Tab through header menus, dropdowns, forms, accordions, popups, sticky mobile buttons, and footer links.",
  });

  issues.push({
    id: "third-party-manual-check",
    severity: "manual",
    rule: "Third-Party Widgets",
    message: "Check maps, reviews, chat, cookie banners, and embedded forms manually.",
    guidance:
      "If a widget creates a keyboard or screen reader issue, document it before launch.",
  });

  const summary = summarizeIssues(issues);

  return {
    target: "WCAG 2.2 AA",
    summary,
    launchReady: summary.fail === 0,
    issues,
    checkedAt: new Date().toISOString(),
  };
}

export function repairElementorHeadingStructure(tree: unknown): void {
  const headings = collectHeadingRefs(tree);
  let h1Seen = false;
  let lastLevel = 0;

  for (const heading of headings) {
    let level = headingNumber(heading.level);
    if (level === 0) continue;

    if (!h1Seen) {
      if (level !== 1) {
        setHeadingLevel(heading, "h1");
        level = 1;
      }
      h1Seen = true;
      lastLevel = level;
      continue;
    }

    if (level === 1) {
      setHeadingLevel(heading, "h2");
      lastLevel = 2;
      continue;
    }

    if (lastLevel > 0 && level > lastLevel + 1) {
      const repaired = Math.min(lastLevel + 1, 6);
      setHeadingLevel(heading, `h${repaired}`);
      lastLevel = repaired;
      continue;
    }

    lastLevel = level;
  }
}

export function accessibilityReportToWarnings(report: AccessibilityReport): string[] {
  return report.issues
    .filter((issue) => issue.severity !== "pass")
    .map((issue) => {
      const page = issue.page ? `${issue.page}: ` : "";
      return `[ACCESSIBILITY ${issue.severity.toUpperCase()}: ${page}${issue.message}]`;
    });
}

function auditBrandColors(colors: BrandColors): AccessibilityIssue[] {
  const checks = [
    {
      id: "contrast-body",
      rule: "Color Contrast",
      label: "Body text on background",
      foreground: colors.text,
      background: colors.background,
      required: 4.5,
    },
    {
      id: "contrast-primary-on-background",
      rule: "Color Contrast",
      label: "Primary text on background",
      foreground: colors.primary,
      background: colors.background,
      required: 4.5,
    },
    {
      id: "contrast-accent-on-background",
      rule: "Color Contrast",
      label: "Accent text on background",
      foreground: colors.accent,
      background: colors.background,
      required: 4.5,
    },
    {
      id: "contrast-text-on-primary",
      rule: "Color Contrast",
      label: "Text color on primary button",
      foreground: colors.text,
      background: colors.primary,
      required: 4.5,
    },
    {
      id: "contrast-background-on-primary",
      rule: "Color Contrast",
      label: "Background color on primary button",
      foreground: colors.background,
      background: colors.primary,
      required: 4.5,
    },
  ];

  return checks.map((check) => {
    const ratio = contrastRatio(check.foreground, check.background);
    const passes = ratio >= check.required;
    return {
      id: check.id,
      severity: passes ? "pass" : "fail",
      rule: check.rule,
      message: `${check.label} contrast ratio is ${ratio.toFixed(2)}:1.`,
      guidance: passes
        ? undefined
        : "Adjust the brand palette or let the builder repair final Elementor text colors before launch.",
    };
  });
}

function auditContent(content: AuditContent): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (const page of content.pages) {
    const pageName = page.slug ?? page.page;
    const payload = page.pageData ?? page.slots ?? {};

    walkValues(payload, (path, value, parent) => {
      const key = path.at(-1) ?? "";
      if (typeof value === "string" && isPotentialCtaKey(key) && isVagueText(value)) {
        issues.push({
          id: `vague-cta-${pageName}-${path.join(".")}`,
          severity: "fail",
          rule: "Button and Link Clarity",
          page: pageName,
          message: `CTA text "${value}" is too vague.`,
          guidance:
            "Use specific text such as Schedule an Appointment, Call the Practice, or View Dental Implant Services.",
        });
      }

      if (typeof value === "string" && isAltKey(key) && !value.trim()) {
        issues.push({
          id: `missing-alt-${pageName}-${path.join(".")}`,
          severity: "fail",
          rule: "Images and Alt Text",
          page: pageName,
          message: "A meaningful image field has empty alt text.",
          guidance:
            "Describe the image naturally, or mark it decorative only when it does not communicate content.",
        });
      }

      if (isObject(parent) && key === "image_url" && typeof value === "string" && value.trim()) {
        const alt = parent.image_alt;
        if (typeof alt !== "string" || !alt.trim()) {
          issues.push({
            id: `missing-image-alt-${pageName}-${path.join(".")}`,
            severity: "fail",
            rule: "Images and Alt Text",
            page: pageName,
            message: "An image URL was supplied without matching image alt text.",
            guidance:
              "Add an image_alt value that describes the image for screen reader users.",
          });
        }
      }
    });
  }

  return issues;
}

function auditElementorPage(page: AccessibilityPageInput): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const headings = collectHeadings(page.elementorData);
  const h1Count = headings.filter((heading) => heading.level === "h1").length;

  issues.push({
    id: `h1-count-${page.page}`,
    severity: h1Count === 1 ? "pass" : "fail",
    rule: "Page Structure and Headings",
    page: page.page,
    message:
      h1Count === 1
        ? "Exactly one H1 was found."
        : `${h1Count} H1 headings were found.`,
    guidance:
      h1Count === 1
        ? undefined
        : "Each page should have one H1 only, then use H2 and H3 for sections.",
  });

  const headingSkip = firstHeadingSkip(headings);
  if (headingSkip) {
    issues.push({
      id: `heading-order-${page.page}`,
      severity: "fail",
      rule: "Page Structure and Headings",
      page: page.page,
      message: headingSkip,
      guidance: "Keep page headings in logical order without skipped levels.",
    });
  } else {
    issues.push({
      id: `heading-order-${page.page}`,
      severity: "pass",
      rule: "Page Structure and Headings",
      page: page.page,
      message: "Heading levels follow a logical order.",
    });
  }

  for (const image of collectImages(page.elementorData)) {
    if (!image.hasImage) continue;
    if (!image.alt.trim() && !isLikelyDecorativeImage(image)) {
      issues.push({
        id: `elementor-image-alt-${page.page}-${image.id}`,
        severity: "warning",
        rule: "Images and Alt Text",
        page: page.page,
        message: "An Elementor image or background image has empty alt text.",
        guidance:
          "Add descriptive alt text for meaningful photos. Decorative images can stay empty.",
      });
    }
  }

  for (const button of collectButtons(page.elementorData)) {
    if (!button.label.trim()) {
      issues.push({
        id: `button-label-${page.page}-${button.id}`,
        severity: "fail",
        rule: "Buttons and Links",
        page: page.page,
        message: "A button has no visible label.",
        guidance: "Add clear action text to the button.",
      });
    } else if (isVagueText(button.label)) {
      issues.push({
        id: `button-vague-${page.page}-${button.id}`,
        severity: "fail",
        rule: "Buttons and Links",
        page: page.page,
        message: `Button text "${button.label}" is too vague.`,
        guidance: "Use specific CTA copy that explains the destination or action.",
      });
    }

    if (button.href.startsWith("tel:") && !/call|phone|\d/.test(button.label.toLowerCase())) {
      issues.push({
        id: `phone-button-${page.page}-${button.id}`,
        severity: "warning",
        rule: "Buttons and Links",
        page: page.page,
        message: "A phone button does not clearly identify that it calls the practice.",
        guidance: "Use text such as Call Orange County Dental Care.",
      });
    }
  }

  return issues;
}

function collectHeadings(tree: unknown): Array<{ id: string; level: string; text: string }> {
  return collectHeadingRefs(tree).map(({ id, level, text }) => ({ id, level, text }));
}

function collectHeadingRefs(tree: unknown): HeadingRef[] {
  const headings: HeadingRef[] = [];

  visitNodes(tree, (node) => {
    const settings = getSettings(node);
    const widgetType = widgetTypeOf(node);

    if (widgetType === "heading" || widgetType === "e-heading") {
      const level = headingLevel(settings.header_size);
      const atomicLevel = headingLevel(settings.tag);
      const resolvedLevel = level ?? atomicLevel;
      if (!resolvedLevel) return;
      headings.push({
        id: nodeId(node),
        level: resolvedLevel,
        text: htmlText(settings.title),
        settings,
        field: level ? "header_size" : "tag",
      });
      return;
    }

    if (widgetType.includes("heading")) {
      const [field, value] = headingField(settings);
      const level = headingLevel(value);
      if (!level) return;
      headings.push({
        id: nodeId(node),
        level,
        text: stringValue(
          settings.ekit_heading_title ??
            settings.title ??
            settings.text ??
            settings.heading_title,
        ),
        settings,
        field,
      });
    }
  });

  return headings;
}

function headingField(settings: ElementorNode): [string, unknown] {
  const fields = [
    "tag",
    "header_size",
    "title_size",
    "ekit_heading_title_tag",
    "ekit_heading_title_html_tag",
  ];
  for (const field of fields) {
    if (settings[field] !== undefined) return [field, settings[field]];
  }
  return ["header_size", undefined];
}

function setHeadingLevel(heading: HeadingRef, level: string): void {
  const current = heading.settings[heading.field];
  heading.settings[heading.field] = isAtomicProp(current)
    ? { ...current, value: level }
    : level;
  heading.level = level;
}

function headingNumber(level: string): number {
  return HEADING_ORDER.indexOf(level) + 1;
}

function collectImages(tree: unknown): Array<{
  id: string;
  alt: string;
  hasImage: boolean;
  url: string;
}> {
  const images: Array<{ id: string; alt: string; hasImage: boolean; url: string }> = [];

  visitNodes(tree, (node) => {
    const settings = getSettings(node);
    const imageValue = unwrapAtomic(settings.image);
    const image = isObject(imageValue) ? imageValue : null;
    if (image) {
      const source = unwrapAtomic(image.src);
      const sourceObject = isObject(source) ? source : image;
      images.push({
        id: nodeId(node),
        alt: stringValue(sourceObject.alt ?? image.alt),
        hasImage: Boolean(stringValue(sourceObject.url)),
        url: stringValue(sourceObject.url),
      });
    }

    const background = isObject(settings.background_image)
      ? settings.background_image
      : null;
    if (background) {
      images.push({
        id: `${nodeId(node)}-background`,
        alt: stringValue(background.alt),
        hasImage: Boolean(stringValue(background.url)),
        url: stringValue(background.url),
      });
    }
  });

  return images;
}

function collectButtons(tree: unknown): Array<{
  id: string;
  label: string;
  href: string;
}> {
  const buttons: Array<{ id: string; label: string; href: string }> = [];

  visitNodes(tree, (node) => {
    const widgetType = widgetTypeOf(node);
    if (!widgetType.includes("button")) return;

    const settings = getSettings(node);
    const atomicLink = unwrapAtomic(settings.link);
    const link = isObject(atomicLink)
      ? atomicLink
      : isObject(settings.sg_content_link)
        ? settings.sg_content_link
        : {};

    buttons.push({
      id: nodeId(node),
      label: htmlText(settings.text ?? settings.button_text ?? settings.sg_content_label),
      href: linkHref(link),
    });
  });

  return buttons;
}

function firstHeadingSkip(headings: Array<{ level: string; text: string }>): string | null {
  let lastLevel = 0;
  for (const heading of headings) {
    const level = HEADING_ORDER.indexOf(heading.level) + 1;
    if (level === 0) continue;
    if (lastLevel > 0 && level > lastLevel + 1) {
      return `Heading "${heading.text || heading.level}" skips from H${lastLevel} to H${level}.`;
    }
    lastLevel = level;
  }
  return null;
}

function isLikelyDecorativeImage(image: { url: string }): boolean {
  return (
    /\.(svg|png)$/i.test(image.url) &&
    /icon|logo|shape|pattern|blanket|tv|headphones/i.test(image.url)
  );
}

function visitNodes(tree: unknown, visitor: (node: ElementorNode) => void): void {
  if (Array.isArray(tree)) {
    tree.forEach((item) => visitNodes(item, visitor));
    return;
  }
  if (!isObject(tree)) return;
  visitor(tree);

  if (Array.isArray(tree.elements)) {
    tree.elements.forEach((child) => visitNodes(child, visitor));
  }
  if (Array.isArray(tree.content)) {
    tree.content.forEach((child) => visitNodes(child, visitor));
  }
}

function walkValues(
  value: unknown,
  visitor: (path: string[], value: unknown, parent: unknown) => void,
  path: string[] = [],
  parent: unknown = null,
): void {
  visitor(path, value, parent);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkValues(item, visitor, [...path, String(index)], value),
    );
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      walkValues(child, visitor, [...path, key], value);
    }
  }
}

function summarizeIssues(issues: AccessibilityIssue[]): AccessibilityReport["summary"] {
  return issues.reduce(
    (summary, issue) => {
      summary[issue.severity] += 1;
      return summary;
    },
    { pass: 0, warning: 0, fail: 0, manual: 0 },
  );
}

function isPotentialCtaKey(key: string): boolean {
  return /cta|button|label|link_text|anchor/i.test(key);
}

function isAltKey(key: string): boolean {
  return key === "alt" || key === "image_alt";
}

function isVagueText(value: string): boolean {
  return VAGUE_LINK_TEXT.has(value.trim().toLowerCase());
}

function headingLevel(value: unknown): string | null {
  const resolved = unwrapAtomic(value);
  if (typeof resolved !== "string") return null;
  const level = resolved.trim().toLowerCase();
  return HEADING_ORDER.includes(level) ? level : null;
}

function getSettings(node: ElementorNode): ElementorNode {
  return isObject(node.settings) ? node.settings : {};
}

function widgetTypeOf(node: ElementorNode): string {
  return typeof node.widgetType === "string" ? node.widgetType.toLowerCase() : "";
}

function nodeId(node: ElementorNode): string {
  return typeof node.id === "string" ? node.id : "unknown";
}

function stringValue(value: unknown): string {
  const resolved = unwrapAtomic(value);
  return typeof resolved === "string" ? resolved : "";
}

function htmlText(value: unknown): string {
  const resolved = unwrapAtomic(value);
  if (!isObject(resolved)) return stringValue(resolved);
  return stringValue(resolved.content);
}

function linkHref(link: ElementorNode): string {
  const direct = stringValue(link.url ?? link.href);
  if (direct) return direct;
  return stringValue(link.destination);
}

function unwrapAtomic(value: unknown): unknown {
  if (isAtomicProp(value)) return unwrapAtomic(value.value);
  return value;
}

function isAtomicProp(value: unknown): value is ElementorNode & { value: unknown } {
  return isObject(value) && typeof value.$$type === "string" && "value" in value;
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex) ?? "#000000";
  const value = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function normalizeHexColor(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  const raw = match[1];
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw;
  return `#${expanded.toUpperCase()}`;
}

function isObject(value: unknown): value is ElementorNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
