import assert from "node:assert/strict";
import { BUILD_WIZARD_STEPS } from "./flow";

assert.deepEqual(BUILD_WIZARD_STEPS, [
  "Crawl",
  "Practice Info",
  "Brand Kit",
  "WP Target",
  "Content",
  "Review",
]);
assert.equal(BUILD_WIZARD_STEPS.includes("Theme" as never), false);

console.log("build wizard flow checks passed");
