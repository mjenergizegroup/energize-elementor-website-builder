import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  ATOMIC_FOUNDATION_VERSION,
  createAtomicFoundation,
  MINIMUM_ELEMENTOR_VERSION,
} from "../src/lib/elementor/atomic/foundation";
import { createAtomicStyleGuide } from "../src/lib/elementor/atomic/style-guide";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts");
const buildDir = path.join(artifactsDir, ".atomic-foundation-build");
const classesDir = path.join(buildDir, "global-classes");
const output = path.join(artifactsDir, "energize-atomic-foundation.zip");
const publicOutput = path.join(
  root,
  "public",
  "downloads",
  "energize-atomic-foundation.zip",
);
const styleGuideOutput = path.join(
  artifactsDir,
  "energize-atomic-style-guide.json",
);
const publicStyleGuideOutput = path.join(
  root,
  "public",
  "downloads",
  "energize-atomic-style-guide.json",
);
const foundation = createAtomicFoundation();

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(classesDir, { recursive: true });

writeJson(path.join(buildDir, "manifest.json"), {
  name: "energize-atomic-foundation",
  title: "Energize Atomic Foundation",
  description:
    "Shared Elementor V4 variables and global classes for Energize websites and landing pages.",
  author: "Energize Group",
  version: "3.0",
  elementor_version: MINIMUM_ELEMENTOR_VERSION,
  created: new Date().toISOString().replace("T", " ").slice(0, 19),
  thumbnail: false,
  site: "https://energizegroup.com",
});

writeJson(path.join(buildDir, "global-variables.json"), {
  data: Object.fromEntries(
    foundation.variables.map(({ id, ...variable }) => [id, variable]),
  ),
  watermark: 1,
  version: 1,
});

for (const globalClass of foundation.classes) {
  writeJson(
    path.join(classesDir, `${globalClass.id}.json`),
    globalClass,
  );
}

writeJson(
  path.join(classesDir, "order.json"),
  foundation.classes.map(({ id, label }) => ({ id, label })),
);

writeJson(path.join(buildDir, "energize-foundation-catalog.json"), {
  name: foundation.name,
  version: ATOMIC_FOUNDATION_VERSION,
  minimumElementorVersion: MINIMUM_ELEMENTOR_VERSION,
  variableCount: foundation.variables.length,
  classCount: foundation.classes.length,
  components: foundation.components,
});

rmSync(output, { force: true });
execFileSync("zip", ["-q", "-r", output, "."], { cwd: buildDir });
mkdirSync(path.dirname(publicOutput), { recursive: true });
copyFileSync(output, publicOutput);
writeJson(styleGuideOutput, createAtomicStyleGuide());
copyFileSync(styleGuideOutput, publicStyleGuideOutput);
rmSync(buildDir, { recursive: true, force: true });

console.log(
  `Built Atomic Foundation and Style Guide downloads with ${foundation.variables.length} variables, ${foundation.classes.length} classes, and ${foundation.components.length} components.`,
);

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
