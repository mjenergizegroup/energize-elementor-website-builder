import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ingestMigrationSource } from "@/lib/migration/projects";

export const runtime = "nodejs";
export const maxDuration = 60;

const pageSchema = z.object({
  url: z.string().url(),
  markdown: z.string().max(2 * 1024 * 1024),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const sourceSchema = z
  .object({
    pages: z.array(pageSchema).min(1).max(1000),
  })
  .superRefine((value, ctx) => {
    const totalBytes = value.pages.reduce(
      (sum, page) => sum + Buffer.byteLength(page.markdown, "utf8"),
      0,
    );
    if (totalBytes > 20 * 1024 * 1024) {
      ctx.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Source content cannot exceed 20MB per ingest.",
      });
    }
  });

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sourceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid source content", detail: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { projectId } = await context.params;
    const result = await ingestMigrationSource(userId, projectId, parsed.data.pages);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not ingest source content.";
    const status = message === "Migration project not found." ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
