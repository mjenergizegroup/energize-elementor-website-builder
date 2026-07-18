import assert from "node:assert/strict";
import { BUILD_WIZARD_STEPS } from "./flow";

assert.deepEqual(BUILD_WIZARD_STEPS, [
  "Crawl",
  "Practice Info",
  "Brand Kit",
  "WP Target",
  "Plan Pages",
  "Review",
]);
assert.equal(BUILD_WIZARD_STEPS.includes("Theme" as never), false);

console.log("build wizard flow checks passed");
