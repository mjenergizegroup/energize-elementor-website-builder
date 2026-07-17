import assert from "node:assert/strict";
import { validateBrandAsset } from "./uploads";

function encoded(bytes: number[] | string): string {
  return Buffer.from(
    typeof bytes === "string" ? bytes : Uint8Array.from(bytes),
  ).toString("base64");
}

validateBrandAsset(
  {
    filename: "logo.png",
    dataBase64: encoded([137, 80, 78, 71, 13, 10, 26, 10, 0]),
  },
  "logo",
);
validateBrandAsset(
  {
    filename: "favicon.ico",
    dataBase64: encoded([0, 0, 1, 0, 1, 0]),
  },
  "favicon",
);
validateBrandAsset(
  {
    filename: "logo.svg",
    dataBase64: encoded('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'),
  },
  "logo",
);

assert.throws(
  () =>
    validateBrandAsset(
      { filename: "logo.png", dataBase64: encoded("not a png") },
      "logo",
    ),
  /must match/,
);
assert.throws(
  () =>
    validateBrandAsset(
      {
        filename: "logo.svg",
        dataBase64: encoded('<svg><script>alert(1)</script></svg>'),
      },
      "logo",
    ),
  /safe SVG/,
);
assert.throws(
  () =>
    validateBrandAsset(
      {
        filename: "logo.svg",
        dataBase64: encoded('<svg><style>path{fill:url(https://tracker.example/pixel)}</style></svg>'),
      },
      "logo",
    ),
  /safe SVG/,
);
assert.throws(
  () =>
    validateBrandAsset(
      {
        filename: "logo.svg",
        dataBase64: encoded('<svg><image href="https://tracker.example/pixel"/></svg>'),
      },
      "logo",
    ),
  /safe SVG/,
);
assert.throws(
  () =>
    validateBrandAsset(
      { filename: "favicon.png", dataBase64: "%%%=" },
      "favicon",
    ),
  /valid base64/,
);

console.log("upload security checks passed");
