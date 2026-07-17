import { z } from "zod";

const assetSchema = z.object({
  filename: z.string().min(1),
  dataBase64: z.string().min(1),
});

const wpPageTemplateSchema = z.enum([
  "default",
  "elementor_header_footer",
  "elementor_canvas",
]);

export const deployBodySchema = z
  .object({
    deployMode: z.enum(["pages", "branding-only"]).default("pages"),
    clientId: z.string().optional(),
    client: z.object({
      name: z.string().min(1),
      slug: z
        .string()
        .min(1)
        .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and dashes"),
      theme: z.string().min(1).optional(),
      wpSiteUrl: z.string().url(),
      wpUsername: z.string().min(1),
      wpAppPassword: z.string().optional(),
    }),
    brandKit: z.object({
      colors: z.object({
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        text: z.string(),
        background: z.string(),
      }),
      fonts: z.object({ heading: z.string(), body: z.string() }),
      logo: assetSchema,
      favicon: assetSchema,
    }),
    content: z.object({
      practiceName: z.string(),
      city: z.string().optional(),
      doctorName: z.string().optional(),
      pages: z.array(
        z.object({
          page: z.string(),
          wpTitle: z.string().optional(),
          slug: z.string().optional(),
          wpPageTemplate: wpPageTemplateSchema.optional(),
          slots: z.record(z.string(), z.any()).optional(),
          builderPageType: z
            .enum([
              "homepage",
              "about",
              "service-page",
              "contact",
              "amenities",
              "first-visit",
              "insurance-and-financing",
            ])
            .optional(),
          serviceSlug: z.string().optional(),
          pageData: z.record(z.string(), z.record(z.string(), z.any())).optional(),
          buildNotes: z.array(z.string()).optional(),
        }),
      ),
      site: z.record(z.string(), z.string()).optional(),
    }),
    elementorVersion: z
      .string()
      .regex(/^4\./, "Elementor V4 is required for Atomic builds.")
      .optional(),
  })
  .superRefine((body, ctx) => {
    if (body.deployMode === "pages" && body.content.pages.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "pages"],
        message: "Select at least one page unless this is a branding-only deploy.",
      });
    }
  });
