import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { buildCombinedMarkdown, rawContentFilename } from "@/lib/firecrawl/export";
import { normalizePageUrl } from "@/lib/firecrawl/filter";
import { getCrawlRecord } from "@/lib/firecrawl/store";

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
  const record = getCrawlRecord(jobId);
  if (!record) {
    return Response.json({ error: "Crawl job not found." }, { status: 404 });
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

  const selected = new Set(body.selectedUrls.map(normalizePageUrl));
  const pages = [...record.filtered.keep, ...record.filtered.skip].filter((page) =>
    selected.has(normalizePageUrl(page.url)),
  );

  if (pages.length === 0) {
    return Response.json({ error: "No selected pages were found for this crawl." }, { status: 400 });
  }

  return Response.json({
    filename: rawContentFilename(record.sourceUrl),
    content: buildCombinedMarkdown(pages),
  });
}
