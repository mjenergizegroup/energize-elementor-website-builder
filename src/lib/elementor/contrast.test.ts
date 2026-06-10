import assert from "node:assert/strict";
import { repairElementorTextContrast } from "./contrast";

type Settings = Record<string, unknown> & {
  __globals__?: Record<string, unknown>;
};

const colors = {
  primary: "#AD9614",
  secondary: "#566169",
  accent: "#F7941D",
  text: "#AD9614",
  background: "#F8F5EA",
};

const page = [
  {
    elType: "container",
    settings: {
      __globals__: {
        background_color: "globals/colors?id=primary",
      },
    },
    elements: [
      {
        elType: "widget",
        widgetType: "heading",
        settings: {
          __globals__: {
            title_color: "globals/colors?id=primary",
          },
        },
      },
    ],
  },
];

repairElementorTextContrast(page, colors);

const heading = page[0].elements[0].settings as Settings;
assert.equal(heading.title_color, "#111111");
assert(heading.__globals__ && !("title_color" in heading.__globals__));

console.log("elementor contrast checks passed");
