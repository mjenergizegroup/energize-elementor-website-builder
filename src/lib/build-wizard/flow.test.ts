import assert from "node:assert/strict";
import { BUILD_WIZARD_STEPS } from "./flow";

assert.deepEqual(BUILD_WIZARD_STEPS, [
  "Project",
  "Plan Pages",
  "Import Content",
  "Brand & Destination",
  "Review & Build",
]);
assert.equal(BUILD_WIZARD_STEPS.includes("Theme" as never), false);

console.log("build wizard flow checks passed");
