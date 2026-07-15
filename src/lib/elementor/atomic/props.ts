import type { AtomicProp, AtomicStyleVariant } from "./types";

export const stringProp = (value: string): AtomicProp<string> => ({
  $$type: "string",
  value,
});

export const numberProp = (value: number): AtomicProp<number> => ({
  $$type: "number",
  value,
});

export const sizeProp = (
  size: number | string,
  unit: string = "px",
): AtomicProp<{ size: number | string; unit: string }> => ({
  $$type: "size",
  value: { size, unit },
});

export const colorProp = (value: string): AtomicProp<string> => ({
  $$type: "color",
  value,
});

export const colorVariable = (id: string): AtomicProp<string> => ({
  $$type: "global-color-variable",
  value: id,
});

export const fontVariable = (id: string): AtomicProp<string> => ({
  $$type: "global-font-variable",
  value: id,
});

export const sizeVariable = (id: string): AtomicProp<string> => ({
  $$type: "global-size-variable",
  value: id,
});

export const backgroundProp = (color: AtomicProp): AtomicProp => ({
  $$type: "background",
  value: { color },
});

export const boxShadowProp = (
  vertical: number,
  blur: number,
  color: string,
  spread = 0,
): AtomicProp => ({
  $$type: "box-shadow",
  value: [
    {
      $$type: "shadow",
      value: {
        hOffset: sizeProp(0),
        vOffset: sizeProp(vertical),
        blur: sizeProp(blur),
        spread: sizeProp(spread),
        color: colorProp(color),
      },
    },
  ],
});

export const dimensionsProp = (
  blockStart: AtomicProp,
  inlineEnd: AtomicProp = blockStart,
  blockEnd: AtomicProp = blockStart,
  inlineStart: AtomicProp = inlineEnd,
): AtomicProp => ({
  $$type: "dimensions",
  value: {
    "block-start": blockStart,
    "inline-end": inlineEnd,
    "block-end": blockEnd,
    "inline-start": inlineStart,
  },
});

export const desktop = (
  props: Record<string, AtomicProp>,
  state: string | null = null,
): AtomicStyleVariant => ({
  meta: { breakpoint: "desktop", state },
  props,
});

export const tablet = (
  props: Record<string, AtomicProp>,
  state: string | null = null,
): AtomicStyleVariant => ({
  meta: { breakpoint: "tablet", state },
  props,
});

export const mobile = (
  props: Record<string, AtomicProp>,
  state: string | null = null,
): AtomicStyleVariant => ({
  meta: { breakpoint: "mobile", state },
  props,
});
