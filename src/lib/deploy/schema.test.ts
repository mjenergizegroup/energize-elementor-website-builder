import assert from "node:assert/strict";
import { deployBodySchema } from "./schema";

const baseRequest = {
  client: {
    name: "Example Dental",
    slug: "example-dental",
    theme: "elevate",
    wpSiteUrl: "https://example.com",
    wpUsername: "builder",
    wpAppPassword: "application-password",
  },
  brandKit: {
    colors: {
      primary: "#111111",
      secondary: "#222222",
      accent: "#333333",
      text: "#444444",
      background: "#ffffff",
    },
    fonts: { heading: "Poppins", body: "Inter" },
    logo: { filename: "logo.svg", dataBase64: "bG9nbw==" },
    favicon: { filename: "favicon.png", dataBase64: "aWNvbg==" },
  },
  content: {
    practiceName: "Example Dental",
    pages: [],
  },
};

const brandingOnly = deployBodySchema.safeParse({
  ...baseRequest,
  deployMode: "branding-only",
});
assert.equal(brandingOnly.success, true);

const requestWithoutThemeSelection = deployBodySchema.safeParse({
  ...baseRequest,
  client: {
    ...baseRequest.client,
    theme: undefined,
  },
  deployMode: "branding-only",
});
assert.equal(requestWithoutThemeSelection.success, true);

const pagesWithoutSelection = deployBodySchema.safeParse({
  ...baseRequest,
  deployMode: "pages",
});
assert.equal(pagesWithoutSelection.success, false);

const legacyRequestWithoutMode = deployBodySchema.safeParse(baseRequest);
assert.equal(legacyRequestWithoutMode.success, false);

const pagesWithSelection = deployBodySchema.safeParse({
  ...baseRequest,
  deployMode: "pages",
  content: {
    ...baseRequest.content,
    pages: [{ page: "homepage" }],
  },
});
assert.equal(pagesWithSelection.success, true);

console.log("deploy schema checks passed");
process.exit(0);
