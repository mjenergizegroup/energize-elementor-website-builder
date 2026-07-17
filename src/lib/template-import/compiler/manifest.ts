import { z } from "zod";
import {
  TEMPLATE_PAGE_ROLES,
  type TemplateMappingManifest,
  type TemplatePageRole,
} from "../types";

const roleValues = TEMPLATE_PAGE_ROLES.map((role) => role.value) as [
  TemplatePageRole,
  ...TemplatePageRole[],
];

const mappingSchema = z.object({
  analysisId: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  selected: z.boolean(),
  role: z.enum(roleValues),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(["ready", "review", "blocked"]),
});

export const templateCompileManifestSchema = z.object({
  schemaVersion: z.literal("1"),
  createdAt: z.string().datetime(),
  mappings: z.array(mappingSchema).min(1).max(20),
});

export function parseTemplateCompileManifest(value: unknown): TemplateMappingManifest {
  return templateCompileManifestSchema.parse(value);
}
