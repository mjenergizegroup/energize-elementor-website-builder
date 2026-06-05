import "server-only";
import { serverEnv } from "@/lib/env";
import type { CrawlStatus, CrawlStatusResult, FirecrawlPage } from "./types";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

export class FirecrawlError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

interface CrawlOptions {
  limit?: number;
}

interface FirecrawlStatusResponse {
  status?: string;
  completed?: number;
  total?: number;
  current?: number;
  next?: string | null;
  data?: Array<{
    url?: string;
    markdown?: string;
    metadata?: Record<string, unknown>;
  }>;
  error?: string;
}

async function firecrawlFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${serverEnv.firecrawlApiKey}`,
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new FirecrawlError(
      `Non-JSON response from Firecrawl (status ${res.status})`,
      res.status,
    );
  }
  if (!res.ok) {
    const err = json as { error?: string; message?: string; code?: string };
    throw new FirecrawlError(
      err.error ?? err.message ?? `Firecrawl returned status ${res.status}`,
      res.status,
      err.code,
    );
  }
  return json as T;
}

export async function crawlSite(
  url: string,
  options: CrawlOptions = {},
): Promise<{ jobId: string; statusUrl: string }> {
  const json = await firecrawlFetch<{ id?: string; jobId?: string; url?: string }>(
    `${FIRECRAWL_BASE}/crawl`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        limit: options.limit ?? 1000,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    },
  );

  const jobId = json.id ?? json.jobId;
  if (!jobId) {
    throw new FirecrawlError("Firecrawl did not return a crawl job ID.", 502);
  }
  return { jobId, statusUrl: `${FIRECRAWL_BASE}/crawl/${jobId}` };
}

export async function getCrawlStatus(jobId: string): Promise<CrawlStatusResult> {
  const pages: FirecrawlPage[] = [];
  let next: string | null | undefined = `${FIRECRAWL_BASE}/crawl/${jobId}`;
  let status: CrawlStatus = "scraping";
  let completed = 0;
  let total = 0;
  let error: string | undefined;
  let guard = 0;

  while (next && guard < 20) {
    guard += 1;
    const json: FirecrawlStatusResponse =
      await firecrawlFetch<FirecrawlStatusResponse>(next);
    status = normalizeStatus(json.status);
    completed = json.completed ?? json.current ?? completed;
    total = json.total ?? total;
    error = json.error ?? error;
    pages.push(...normalizePages(json.data ?? []));
    next = json.next;
  }

  return { status, completed, total, data: pages, error };
}

function normalizeStatus(value: string | undefined): CrawlStatus {
  if (value === "completed" || value === "failed") return value;
  return "scraping";
}

function normalizePages(
  pages: NonNullable<FirecrawlStatusResponse["data"]>,
): FirecrawlPage[] {
  return pages
    .map((page) => {
      const metadata = page.metadata ?? {};
      const sourceUrl =
        page.url ??
        (typeof metadata.sourceURL === "string" ? metadata.sourceURL : "");
      return {
        url: sourceUrl,
        markdown: page.markdown ?? "",
        metadata,
      };
    })
    .filter((page) => page.url && page.markdown);
}
