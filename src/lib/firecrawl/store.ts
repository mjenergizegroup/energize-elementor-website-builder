import "server-only";
import { filterPages } from "./filter";
import type { CrawlStatus, FilteredPages, FirecrawlPage } from "./types";

export interface CrawlRecord {
  jobId: string;
  sourceUrl: string;
  startedAt: number;
  status: CrawlStatus;
  completed: number;
  total: number;
  pages: FirecrawlPage[];
  filtered: FilteredPages;
  error?: string;
}

const globalForCrawls = globalThis as typeof globalThis & {
  __energizeCrawls?: Map<string, CrawlRecord>;
};

const crawlStore = globalForCrawls.__energizeCrawls ?? new Map<string, CrawlRecord>();
globalForCrawls.__energizeCrawls = crawlStore;

export function createCrawlRecord(jobId: string, sourceUrl: string): CrawlRecord {
  const record: CrawlRecord = {
    jobId,
    sourceUrl,
    startedAt: Date.now(),
    status: "scraping",
    completed: 0,
    total: 0,
    pages: [],
    filtered: { keep: [], skip: [] },
  };
  crawlStore.set(jobId, record);
  return record;
}

export function getCrawlRecord(jobId: string): CrawlRecord | undefined {
  return crawlStore.get(jobId);
}

export function updateCrawlRecord(
  jobId: string,
  patch: Partial<Omit<CrawlRecord, "jobId" | "sourceUrl" | "startedAt">>,
): CrawlRecord | undefined {
  const current = crawlStore.get(jobId);
  if (!current) return undefined;
  const pages = patch.pages ?? current.pages;
  const next = {
    ...current,
    ...patch,
    pages,
    filtered: patch.filtered ?? filterPages(pages),
  };
  crawlStore.set(jobId, next);
  return next;
}

export function crawlTimedOut(record: CrawlRecord): boolean {
  return Date.now() - record.startedAt > 10 * 60 * 1000;
}

export function pruneCrawlStore(): void {
  const maxAge = 2 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [jobId, record] of crawlStore.entries()) {
    if (now - record.startedAt > maxAge) crawlStore.delete(jobId);
  }
}
