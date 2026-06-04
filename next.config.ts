import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // This project lives under a parent folder that also has a lockfile; pin the
  // tracing root to the project so file tracing stays correct.
  outputFileTracingRoot: projectRoot,
  // Ensure the theme template JSON files are bundled into the serverless
  // function output. They are loaded from disk at runtime (see
  // src/lib/injection/loader.ts), which is what keeps adding a v2 theme
  // purely additive: drop files into theme-templates/{theme}/ and no import
  // statements need to change.
  outputFileTracingIncludes: {
    "/**": ["./theme-templates/**/*.json"],
  },
};

export default nextConfig;
