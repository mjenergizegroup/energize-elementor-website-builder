import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "wordpress-plugin/energize-build-tool.php"),
  "utf8",
);
const expectedSnippet = source.replace(/^<\?php\s*\n/, "");
const artifactSnippet = readFileSync(
  resolve(process.cwd(), "artifacts/energize-build-tool-wpcode-snippet.txt"),
  "utf8",
);
const publicSnippet = readFileSync(
  resolve(
    process.cwd(),
    "public/downloads/energize-build-tool-wpcode-snippet.txt",
  ),
  "utf8",
);
const openingCommentEnd = source.indexOf("*/");
const liveSource = source.slice(openingCommentEnd + 2);

assert.equal(openingCommentEnd > 0, true);
assert.equal(
  liveSource.includes(
    "define('ENERGIZE_BUILD_SECRET', 'PASTE_YOUR_EXISTING_SECRET_HERE');",
  ),
  true,
  "The WPCode secret configuration must be live PHP outside the opening comment.",
);
assert.equal(
  source.includes("register_rest_route('energize/v1', '/health'"),
  true,
);
assert.equal(source.includes("function energize_build_health()"), true);
assert.equal(source.includes("ENERGIZE_BUILD_TOOL_VERSION', '2.3.0'"), true);
assert.equal(
  source.includes("array('section', 'column', 'container')"),
  true,
  "The bridge must accept sanitized classic layout elements in Elementor 4 hybrid documents.",
);
assert.equal(
  source.includes("'button', 'google_maps', 'heading', 'html', 'icon', 'icon-box', 'icon-list', 'image', 'shortcode', 'text-editor'"),
  true,
  "The bridge must use the reviewed classic widget allowlist.",
);
assert.equal(source.includes("energize_unsupported_element"), true);
assert.equal(
  source.includes("The WPCode Bridge secret is not configured."),
  true,
);
assert.equal(artifactSnippet, expectedSnippet);
assert.equal(publicSnippet, expectedSnippet);
assert.equal(source.includes("/brand-colors"), false);
assert.equal(source.includes("/brand-fonts"), false);
assert.equal(source.includes(String.fromCodePoint(0x2014)), false);

console.log("WPCode bridge snippet contract checks passed");
