import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCrawlStatus } from "@/lib/firecrawl/client";
import { buildCombinedMarkdown, rawContentFilename } from "@/lib/firecrawl/export";
import { filterPages, selectFilteredPages } from "@/lib/firecrawl/filter";
import { getCrawlRecord } from "@/lib/firecrawl/store";
import { getMigrationProjectByCrawlJob } from "@/lib/migration/projects";

export const runtime = "nodejs";

const bodySchema = z.object({
  selectedUrls: z.array(z.string().url()).min(1),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const project = await getMigrationProjectByCrawlJob(userId, jobId);
  if (!project) {
    return Response.json({ error: "Crawl not found." }, { status: 404 });
  }
  const record = getCrawlRecord(jobId);
  if (record && record.userId !== userId) {
    return Response.json({ error: "Crawl not found." }, { status: 404 });
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

  const filtered = record?.filtered ?? filterPages((await getCrawlStatus(jobId)).data);
  const pages = selectFilteredPages(filtered, body.selectedUrls);

  if (pages.length === 0) {
    return Response.json({ error: "No selected pages were found for this crawl." }, { status: 400 });
  }

  return Response.json({
    filename: rawContentFilename(record?.sourceUrl || pages[0].url),
    content: buildCombinedMarkdown(pages),
  });
}
