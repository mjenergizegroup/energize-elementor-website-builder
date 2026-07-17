import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { crawlSite, FirecrawlError } from "@/lib/firecrawl/client";
import { createCrawlRecord, pruneCrawlStore } from "@/lib/firecrawl/store";
import { createMigrationProject } from "@/lib/migration/projects";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  url: z.string().url(),
  clientId: z.string().min(1).optional(),
  projectName: z.string().trim().min(1).max(160).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return Response.json(
      { error: "Invalid request", detail: e instanceof z.ZodError ? e.issues : String(e) },
      { status: 400 },
    );
  }

  try {
    pruneCrawlStore();
    const { jobId } = await crawlSite(body.url);
    const project = await createMigrationProject(userId, {
      name: body.projectName ?? defaultProjectName(body.url),
      sourceUrl: body.url,
      clientId: body.clientId,
      crawlJobId: jobId,
    });
    createCrawlRecord(jobId, body.url, userId, project.id);
    return Response.json({ jobId, projectId: project.id });
  } catch (e) {
    return firecrawlErrorResponse(e);
  }
}

function defaultProjectName(sourceUrl: string): string {
  const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
  return `${hostname} migration`;
}

function firecrawlErrorResponse(e: unknown): Response {
  if (e instanceof FirecrawlError) {
    if (e.status === 429) {
      return Response.json(
        { error: "Rate limited, try again in a minute" },
        { status: 429 },
      );
    }
    if (e.status === 403) {
      return Response.json(
        { error: "This site blocked the crawler. Use a different source." },
        { status: 403 },
      );
    }
    return Response.json({ error: e.message }, { status: e.status || 502 });
  }
  return Response.json(
    { error: e instanceof Error ? e.message : "Could not start crawl." },
    { status: 500 },
  );
}
