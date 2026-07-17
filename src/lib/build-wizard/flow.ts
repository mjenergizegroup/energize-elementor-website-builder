export const BUILD_WIZARD_STEPS = [
  "Crawl",
  "Practice Info",
  "Brand Kit",
  "WP Target",
  "Content",
  "Review",
] as const;

export type BuildWizardStep = (typeof BUILD_WIZARD_STEPS)[number];
