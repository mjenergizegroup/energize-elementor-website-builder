export interface FirecrawlPage {
  url: string;
  markdown: string;
  metadata: Record<string, unknown>;
}

export interface PageEntry extends FirecrawlPage {
  title: string;
  recommended: boolean;
  skipReason?: string;
}

export interface FilteredPages {
  keep: PageEntry[];
  skip: PageEntry[];
}

export type CrawlStatus = "scraping" | "completed" | "failed";

export interface CrawlStatusResult {
  status: CrawlStatus;
  completed: number;
  total: number;
  data: FirecrawlPage[];
  error?: string;
}
