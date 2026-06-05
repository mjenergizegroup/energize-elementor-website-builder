import { auth } from "@clerk/nextjs/server";
import { getCrawlStatus, FirecrawlError } from "@/lib/firecrawl/client";
import {
  crawlTimedOut,
  getCrawlRecord,
  updateCrawlRecord,
} from "@/lib/firecrawl/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
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

  try {
    const status = await getCrawlStatus(jobId);
    const next = updateCrawlRecord(jobId, {
      status: status.status,
      completed: status.completed,
      total: status.total,
      pages: status.data,
      error: status.error,
    });

    if (!next) {
      return Response.json({ error: "Crawl job not found." }, { status: 404 });
    }

    if (crawlTimedOut(next) && next.status === "scraping") {
      const timedOut = updateCrawlRecord(jobId, {
        status: "failed",
        error: "Crawl timed out after 10 minutes.",
      });
      return crawlResponse(timedOut ?? next);
    }

    return crawlResponse(next);
  } catch (e) {
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
      const failed = updateCrawlRecord(jobId, {
        status: "failed",
        error: e.message,
      });
      return Response.json(crawlPayload(failed ?? record), { status: e.status || 502 });
    }
    const failed = updateCrawlRecord(jobId, {
      status: "failed",
      error: e instanceof Error ? e.message : "Crawl failed.",
    });
    return Response.json(crawlPayload(failed ?? record), { status: 500 });
  }
}

function crawlResponse(record: NonNullable<ReturnType<typeof getCrawlRecord>>) {
  return Response.json(crawlPayload(record));
}

function crawlPayload(record: NonNullable<ReturnType<typeof getCrawlRecord>>) {
  const progress = {
    completed: record.completed,
    total: record.total,
  };
  const pages =
    record.status === "completed" || record.status === "failed"
      ? [
          ...record.filtered.keep,
          ...record.filtered.skip.map((page) => ({
            ...page,
            recommended: false,
          })),
        ]
      : null;
  return {
    status: record.status,
    progress,
    pages,
    keep: record.status === "completed" || record.status === "failed" ? record.filtered.keep : null,
    skip: record.status === "completed" || record.status === "failed" ? record.filtered.skip : null,
    error: record.error,
  };
}
