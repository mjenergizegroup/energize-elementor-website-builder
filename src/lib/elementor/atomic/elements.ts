import { randomBytes } from "node:crypto";
import type {
  AtomicElement,
  AtomicGlobalClass,
  AtomicProp,
  AtomicStyleVariant,
} from "./types";

function id(): string {
  return randomBytes(4).toString("hex");
}

function typed<T>(type: string, value: T): AtomicProp<T> {
  return { $$type: type, value };
}

function base(
  elType: string,
  settings: Record<string, AtomicProp>,
  elements: AtomicElement[] = [],
  widgetType?: string,
): AtomicElement {
  return {
    id: id(),
    version: "0.0",
    elType,
    ...(widgetType ? { widgetType } : {}),
    settings,
    editor_settings: {},
    interactions: [],
    styles: [],
    elements,
  };
}

function classSetting(classes: string[]): AtomicProp<string[]> {
  return typed("classes", classes);
}

export function flexbox(
  classes: string[],
  elements: AtomicElement[] = [],
  tag: "div" | "header" | "section" | "article" | "aside" | "footer" = "div",
): AtomicElement {
  return base(
    "e-flexbox",
    {
      classes: classSetting(classes),
      tag: typed("string", tag),
    },
    elements,
  );
}

export function divBlock(
  classes: string[],
  elements: AtomicElement[] = [],
  tag = "div",
): AtomicElement {
  return base(
    "e-div-block",
    {
      classes: classSetting(classes),
      tag: typed("string", tag),
    },
    elements,
  );
}

export function heading(
  text: string,
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
  classes: string[],
): AtomicElement {
  return base(
    "widget",
    {
      classes: classSetting(classes),
      tag: typed("string", tag),
      title: typed("html-v3", {
        content: typed("string", text),
        children: [],
      }),
    },
    [],
    "e-heading",
  );
}

export function paragraph(text: string, classes: string[]): AtomicElement {
  return base(
    "widget",
    {
      classes: classSetting(classes),
      paragraph: typed("html-v3", {
        content: typed("string", text),
        children: [],
      }),
    },
    [],
    "e-paragraph",
  );
}

export function button(
  text: string,
  href: string,
  classes: string[],
): AtomicElement {
  return base(
    "widget",
    {
      classes: classSetting(classes),
      text: typed("html-v3", {
        content: typed("string", text),
        children: [],
      }),
      link: typed("link", {
        destination: typed("url", href),
        isTargetBlank: typed("boolean", false),
      }),
      tag: typed("string", "a"),
    },
    [],
    "e-button",
  );
}

export function image(
  src: string,
  alt: string,
  classes: string[],
): AtomicElement {
  return base(
    "widget",
    {
      classes: classSetting(classes),
      image: typed("image", {
        src: typed("image-src", {
          url: typed("url", src),
          alt: typed("string", alt),
        }),
        size: typed("string", "full"),
      }),
    },
    [],
    "e-image",
  );
}

export function componentInstance(
  componentId: number,
  componentUid: string,
): AtomicElement {
  const element = base(
    "widget",
    {
      component_instance: typed("component-instance", {
        component_id: typed("number", componentId),
        overrides: typed("overrides", []),
      }),
    },
    [],
    "e-component",
  );
  element.editor_settings = { component_uid: componentUid };
  return element;
}

export function legacyEmbed(
  widgetType: "html" | "shortcode" | "google_maps",
  settings: Record<string, unknown>,
): AtomicElement {
  return {
    id: id(),
    version: "0.0",
    elType: "widget",
    widgetType,
    settings,
    editor_settings: {},
    interactions: [],
    styles: [],
    elements: [],
  };
}

export function withLocalStyle(
  element: AtomicElement,
  variants: AtomicStyleVariant[],
): AtomicElement {
  const styleId = `e-l-${element.id}`;
  const style: AtomicGlobalClass = {
    id: styleId,
    label: "local",
    type: "class",
    variants,
  };
  element.styles = { [styleId]: style };
  return element;
}
