import type { MigrationSourcePage } from "@/lib/migration/types";
import type { PagePlanItemInput } from "@/lib/page-plan/types";
import type {
  ContentMatchCandidate,
  ContentMatchResult,
} from "./types";

const TOKEN_ALIASES: Record<string, string> = {
  dentistry: "dentist",
  dentists: "dentist",
  preventative: "preventive",
  whitening: "whiten",
  whitened: "whiten",
  implants: "implant",
  amenities: "amenity",
  financing: "finance",
};

export function matchPagePlanToSource(
  plan: PagePlanItemInput[],
  sourcePages: MigrationSourcePage[],
  history: Record<string, string | undefined> = {},
): ContentMatchResult[] {
  const usable = sourcePages.filter(
    (page) =>
      page.included &&
      page.classification !== "skipped" &&
      page.classification !== "blog-post",
  );

  return plan.map((item) => {
    const candidates = usable
      .map((page) => scoreCandidate(item, page, history[item.id]))
      .filter((candidate) => candidate.score >= 35)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 5);
    const top = candidates[0];
    const runnerUp = candidates[1];

    if (!top || top.score < 45) {
      return {
        pagePlanItemId: item.id,
        score: 0,
        signals: [],
        candidates,
        status: "empty",
        confirmedByUser: false,
      };
    }

    const gap = top.score - (runnerUp?.score ?? 0);
    const strong =
      top.signals.includes("Same URL path") ||
      (top.score >= 85 && gap >= 15) ||
      (top.score >= 65 && !runnerUp);
    return {
      pagePlanItemId: item.id,
      sourcePageId: strong ? top.sourcePageId : undefined,
      score: top.score,
      signals: top.signals,
      candidates,
      status: strong ? "matched" : "check",
      confirmedByUser: false,
      normalizedContentRevision: strong
        ? usable.find((page) => page.id === top.sourcePageId)?.contentRevision
        : undefined,
    };
  });
}

export function findSourceByCandidatePath(
  pages: MigrationSourcePage[],
  candidate: Pick<ContentMatchCandidate, "path">,
): MigrationSourcePage | undefined {
  return pages.find(
    (page) =>
      page.included &&
      page.classification !== "skipped" &&
      page.classification !== "blog-post" &&
      displayPath(page.normalizedUrl || page.sourceUrl) === candidate.path,
  );
}

function scoreCandidate(
  item: PagePlanItemInput,
  page: MigrationSourcePage,
  historicSourcePageId?: string,
): ContentMatchCandidate {
  const signals: string[] = [];
  let score = 0;
  const plannedPath = normalizePath(item.slug);
  const sourcePath = sourcePathname(page.normalizedUrl || page.sourceUrl);
  const plannedName = normalizeText(item.pageName);
  const sourceTitle = normalizeText(page.title);
  const plannedTokens = tokenSet(item.pageName);
  const titleTokens = tokenSet(page.title);
  const pathTokens = tokenSet(sourcePath.replaceAll("/", " "));
  const headingTokens = tokenSet(extractHeadings(page.cleanedMarkdown));

  if (plannedPath === sourcePath) {
    score += 100;
    signals.push("Same URL path");
  } else {
    const pathSimilarity = similarity(plannedTokens, pathTokens);
    if (pathSimilarity >= 0.8) {
      score += 72;
      signals.push("Similar URL path");
    } else if (pathSimilarity >= 0.5) {
      score += 42;
      signals.push("Related URL path");
    }
  }

  if (plannedName && plannedName === sourceTitle) {
    score += 92;
    signals.push("Same page title");
  } else {
    const titleSimilarity = similarity(plannedTokens, titleTokens);
    if (containsAll(titleTokens, plannedTokens) && plannedTokens.size > 0) {
      score += 78;
      signals.push("Page title contains the planned name");
    } else if (titleSimilarity >= 0.7) {
      score += 64;
      signals.push("Similar page title");
    } else if (titleSimilarity >= 0.45) {
      score += 36;
      signals.push("Related page title");
    }
  }

  const headingSimilarity = similarity(plannedTokens, headingTokens);
  if (headingSimilarity >= 0.8) {
    score += 50;
    signals.push("Matching page heading");
  } else if (headingSimilarity >= 0.5) {
    score += 28;
    signals.push("Related page heading");
  }

  if (historicSourcePageId === page.id) {
    score += 12;
    signals.push("Previously selected for this page");
  }

  return {
    sourcePageId: page.id,
    title: page.title,
    path: displayPath(page.normalizedUrl || page.sourceUrl),
    preview: contentPreview(page.cleanedMarkdown),
    score,
    signals,
  };
}

function normalizePath(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "/";
}

function sourcePathname(value: string): string {
  try {
    return normalizePath(new URL(value).pathname);
  } catch {
    return normalizePath(value);
  }
}

function displayPath(value: string): string {
  try {
    const path = new URL(value).pathname.replace(/\/+$/, "");
    return path || "/";
  } catch {
    return sourcePathname(value);
  }
}

function normalizeText(value: string): string {
  return [...tokenSet(value)].join(" ");
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/&amp;|&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 1)
      .map((token) => TOKEN_ALIASES[token] ?? token)
      .filter((token) => !["page", "our", "the", "and"].includes(token)),
  );
}

function similarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function containsAll(container: Set<string>, requested: Set<string>): boolean {
  return [...requested].every((token) => container.has(token));
}

function extractHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, ""))
    .join(" ");
}

function contentPreview(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
