import { auth } from "@clerk/nextjs/server";
import { getCrawlStatus, FirecrawlError } from "@/lib/firecrawl/client";
import { filterPages } from "@/lib/firecrawl/filter";
import type { CrawlRecord } from "@/lib/firecrawl/store";
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

  try {
    const status = await getCrawlStatus(jobId);
    const next =
      record &&
      updateCrawlRecord(jobId, {
        status: status.status,
        completed: status.completed,
        total: status.total,
        pages: status.data,
        error: status.error,
      });
    const fallback = makeFallbackRecord(jobId, status);
    const current = next || fallback;

    if (record && crawlTimedOut(current) && current.status === "scraping") {
      const timedOut = updateCrawlRecord(jobId, {
        status: "failed",
        error: "Crawl timed out after 10 minutes.",
      });
      return crawlResponse(timedOut ?? current);
    }

    return crawlResponse(current);
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
      const failed =
        record &&
        updateCrawlRecord(jobId, {
          status: "failed",
          error: e.message,
        });
      return Response.json(
        crawlPayload(
          failed ??
            record ?? {
              jobId,
              sourceUrl: "",
              startedAt: Date.now(),
              status: "failed",
              completed: 0,
              total: 0,
              pages: [],
              filtered: { keep: [], skip: [] },
              error: e.message,
            },
        ),
        { status: e.status || 502 },
      );
    }
    const message = e instanceof Error ? e.message : "Crawl failed.";
    const failed =
      record &&
      updateCrawlRecord(jobId, {
        status: "failed",
        error: message,
      });
    return Response.json(
      crawlPayload(
        failed ??
          record ?? {
            jobId,
            sourceUrl: "",
            startedAt: Date.now(),
            status: "failed",
            completed: 0,
            total: 0,
            pages: [],
            filtered: { keep: [], skip: [] },
            error: message,
          },
      ),
      { status: 500 },
    );
  }
}

function makeFallbackRecord(
  jobId: string,
  status: Awaited<ReturnType<typeof getCrawlStatus>>,
): CrawlRecord {
  return {
    jobId,
    sourceUrl: status.data[0]?.url ?? "",
    startedAt: Date.now(),
    status: status.status,
    completed: status.completed,
    total: status.total,
    pages: status.data,
    filtered: filterPages(status.data),
    error: status.error,
  };
}

function crawlResponse(record: CrawlRecord) {
  return Response.json(crawlPayload(record));
}

function crawlPayload(record: CrawlRecord) {
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
