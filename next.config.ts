import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
