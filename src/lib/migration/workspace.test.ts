import assert from "node:assert/strict";
import { migrationWizardWorkspaceSchema } from "./deploy/schema";

const workspace = {
  schemaVersion: 1,
  step: 4,
  siteKind: "existing",
  deployMode: "pages",
  name: "Example Dental",
  slug: "example-dental",
  address: "",
  phone: "",
  email: "",
  hours: "",
  bookingLink: "",
  social: "",
  siteUrl: "https://wp.example.com",
  username: "builder@example.com",
  colors: {
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    text: "#444444",
    background: "#ffffff",
  },
  fonts: { heading: "Poppins", body: "Inter" },
} as const;

assert.equal(migrationWizardWorkspaceSchema.safeParse(workspace).success, true);
assert.equal(
  migrationWizardWorkspaceSchema.safeParse({
    ...workspace,
    appPassword: "must-not-be-stored",
  }).success,
  false,
);
assert.equal(
  migrationWizardWorkspaceSchema.safeParse({ ...workspace, step: 6 }).success,
  false,
);

console.log("migration workspace checks passed");
