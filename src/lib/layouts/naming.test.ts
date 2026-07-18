import assert from "node:assert/strict";
import {
  generatedLayoutNumber,
  inferLayoutCategory,
  layoutDisplayName,
} from "./naming";

assert.equal(
  layoutDisplayName({ friendlyName: "Flexible Layout 2", category: "home" }),
  "Home Layout 2",
);
assert.equal(
  layoutDisplayName({ friendlyName: "Flexible Layout 3", category: "service" }),
  "Service Layout 3",
);
assert.equal(
  layoutDisplayName({ friendlyName: "Modern Dental Home", category: "home" }),
  "Modern Dental Home",
);
assert.equal(generatedLayoutNumber("About Layout 7"), 7);
assert.equal(inferLayoutCategory("Myrtle-Groove-Home.json"), "home");
assert.equal(inferLayoutCategory("Myrtle-Groove-about-us (1).json"), "about");
assert.equal(inferLayoutCategory("Eckley Service Page Template Revised.json"), "service");
assert.equal(inferLayoutCategory("Interior Page.json"), "flexible");

console.log("layout naming checks passed");
