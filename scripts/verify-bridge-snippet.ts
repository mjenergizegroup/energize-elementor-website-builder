import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "wordpress-plugin/energize-build-tool.php"),
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
assert.equal(source.includes("ENERGIZE_BUILD_TOOL_VERSION', '2.1.0'"), true);
assert.equal(source.includes("/brand-colors"), false);
assert.equal(source.includes("/brand-fonts"), false);
assert.equal(source.includes(String.fromCodePoint(0x2014)), false);

console.log("WPCode bridge snippet contract checks passed");
