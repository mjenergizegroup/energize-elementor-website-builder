import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCrawlStatus } from "@/lib/firecrawl/client";
import { filterPages, selectFilteredPages } from "@/lib/firecrawl/filter";
import {
  getMigrationProject,
  ingestMigrationSource,
} from "@/lib/migration/projects";

export const runtime = "nodejs";
export const maxDuration = 60;

const pageSchema = z.object({
  url: z.string().url(),
  markdown: z.string().max(2 * 1024 * 1024),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const uploadedSourceSchema = z
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

const crawlSourceSchema = z.object({
  crawlJobId: z.string().trim().min(1).max(200),
  selectedUrls: z.array(z.string().url()).min(1).max(1000),
});

const sourceSchema = z.union([uploadedSourceSchema, crawlSourceSchema]);

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
    const pages = "pages" in parsed.data
      ? parsed.data.pages
      : await selectedCrawlPages(
          userId,
          projectId,
          parsed.data.crawlJobId,
          parsed.data.selectedUrls,
        );
    const result = await ingestMigrationSource(userId, projectId, pages);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not ingest source content.";
    const status = message === "Migration project not found." ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

async function selectedCrawlPages(
  userId: string,
  projectId: string,
  crawlJobId: string,
  selectedUrls: string[],
) {
  const project = await getMigrationProject(userId, projectId);
  if (project.crawlJobId !== crawlJobId) {
    throw new Error("The crawl does not belong to this migration project.");
  }
  const status = await getCrawlStatus(crawlJobId);
  const pages = selectFilteredPages(filterPages(status.data), selectedUrls);
  if (pages.length === 0) {
    throw new Error("No selected pages were found for this crawl.");
  }
  return pages;
}
