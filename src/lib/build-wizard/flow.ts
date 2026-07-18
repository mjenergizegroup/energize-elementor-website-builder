export const BUILD_WIZARD_STEPS = [
  "Project",
  "Plan Pages",
  "Import Content",
  "Brand & Destination",
  "Review & Build",
] as const;

export type BuildWizardStep = (typeof BUILD_WIZARD_STEPS)[number];
