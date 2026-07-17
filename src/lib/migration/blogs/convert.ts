import type {
  MigrationAsset,
  MigrationBlogDraft,
  MigrationSourcePage,
} from "../types";

interface FrontMatter {
  values: Record<string, string>;
  body: string;
}

interface ResolvedImage {
  sourceUrl: string;
  destinationUrl: string;
  mediaId: number;
  assetId: string;
  altText: string;
}

const IMAGE_PATTERN = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/g;

export function buildBlogDrafts(
  pages: MigrationSourcePage[],
  assets: MigrationAsset[],
): MigrationBlogDraft[] {
  const assetsByUrl = new Map<string, MigrationAsset>();
  for (const asset of assets) {
    assetsByUrl.set(asset.sourceUrl, asset);
    assetsByUrl.set(asset.originalUrl, asset);
  }

  return pages.map((page) => {
    const frontMatter = parseFrontMatter(page.cleanedMarkdown);
    const body = promoteStandaloneBoldHeadings(frontMatter.body);
    const images = extractImages(body);
    const sourceImageUrls = unique(images.map((image) => image.url));
    const imageAssets = sourceImageUrls
      .map((url) => assetsByUrl.get(url))
      .filter((asset): asset is MigrationAsset => Boolean(asset));
    const resolvedImages = new Map<string, ResolvedImage>();
    for (const asset of imageAssets) {
      if (!asset.destinationMediaId || !asset.destinationUrl) continue;
      resolvedImages.set(asset.originalUrl, {
        sourceUrl: asset.originalUrl,
        destinationUrl: asset.destinationUrl,
        mediaId: asset.destinationMediaId,
        assetId: asset.id,
        altText: asset.altText,
      });
      resolvedImages.set(asset.sourceUrl, {
        sourceUrl: asset.sourceUrl,
        destinationUrl: asset.destinationUrl,
        mediaId: asset.destinationMediaId,
        assetId: asset.id,
        altText: asset.altText,
      });
    }

    const featuredImageUrl = firstString(
      frontMatter.values.featured_image,
      frontMatter.values.featuredimage,
      frontMatter.values.image,
      metadataString(page.metadata, "featuredImage"),
      metadataString(page.metadata, "ogImage"),
      sourceImageUrls[0],
    );
    const featuredAsset = featuredImageUrl
      ? assetsByUrl.get(featuredImageUrl)
      : undefined;
    const unresolvedImageUrls = sourceImageUrls.filter(
      (url) => !resolvedImages.has(url),
    );
    if (
      featuredImageUrl &&
      (!featuredAsset?.destinationMediaId || !featuredAsset.destinationUrl) &&
      !unresolvedImageUrls.includes(featuredImageUrl)
    ) {
      unresolvedImageUrls.push(featuredImageUrl);
    }

    const title = firstString(
      frontMatter.values.title,
      page.title,
      firstHeading(body),
      "Untitled post",
    ) as string;
    const slug = normalizeSlug(
      firstString(
        frontMatter.values.slug,
        metadataString(page.metadata, "slug"),
        slugFromUrl(page.normalizedUrl),
        title,
      ) as string,
    );

    return {
      id: `blog-${page.id}`,
      sourcePageId: page.id,
      title,
      slug,
      date: normalizeDate(
        firstString(
          frontMatter.values.date,
          frontMatter.values.published_at,
          frontMatter.values.published,
          metadataString(page.metadata, "publishedAt"),
          metadataString(page.metadata, "datePublished"),
          metadataString(page.metadata, "date"),
        ),
      ),
      excerpt: firstString(
        frontMatter.values.excerpt,
        frontMatter.values.description,
        metadataString(page.metadata, "description"),
      ),
      gutenbergContent: markdownToGutenberg(body, resolvedImages),
      sourceImageUrls,
      imageAssetIds: unique(imageAssets.map((asset) => asset.id)),
      unresolvedImageUrls,
      featuredImageUrl,
      featuredAssetId: featuredAsset?.id,
      featuredMediaId: featuredAsset?.destinationMediaId,
      status: unresolvedImageUrls.length === 0 ? "ready" : "pending",
      attemptCount: 0,
    };
  });
}

export function parseFrontMatter(markdown: string): FrontMatter {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return { values: {}, body: markdown.trim() };
  const values: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (!pair) continue;
    values[pair[1].toLowerCase()] = stripWrappingQuotes(pair[2]);
  }
  return { values, body: markdown.slice(match[0].length).trim() };
}

export function promoteStandaloneBoldHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^\*\*([^*]{2,100})\*\*$/);
      if (!match || /[.!?]$/.test(match[1])) return line;
      return `## ${match[1].trim()}`;
    })
    .join("\n");
}

export function markdownToGutenberg(
  markdown: string,
  resolvedImages: ReadonlyMap<string, ResolvedImage> = new Map(),
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: Array<{ ordered: boolean; text: string }> = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const html = paragraph.map(inlineMarkdown).join(" ");
    blocks.push(`<!-- wp:paragraph -->\n<p>${html}</p>\n<!-- /wp:paragraph -->`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    const ordered = list[0].ordered;
    const tag = ordered ? "ol" : "ul";
    const attrs = ordered ? ' {"ordered":true}' : "";
    const items = list.map((item) => `<li>${inlineMarkdown(item.text)}</li>`).join("");
    blocks.push(`<!-- wp:list${attrs} -->\n<${tag}>${items}</${tag}>\n<!-- /wp:list -->`);
    list = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      flushParagraph();
      flushList();
      if (code) {
        blocks.push(`<!-- wp:code -->\n<pre class="wp-block-code"><code>${escapeHtml(code.join("\n"))}</code></pre>\n<!-- /wp:code -->`);
        code = null;
      } else {
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const image = line.trim().match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)$/);
    const listItem = line.match(/^\s*(?:(\d+)\.|[-*+])\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<!-- wp:heading {"level":${level}} -->\n<h${level} class="wp-block-heading">${inlineMarkdown(heading[2])}</h${level}>\n<!-- /wp:heading -->`);
    } else if (image) {
      flushParagraph();
      flushList();
      blocks.push(imageBlock(image[2], image[1], resolvedImages.get(image[2])));
    } else if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[1]);
      if (list.length > 0 && list[0].ordered !== ordered) flushList();
      list.push({ ordered, text: listItem[2] });
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${inlineMarkdown(quote[1])}</p></blockquote>\n<!-- /wp:quote -->`);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  if (code) {
    blocks.push(`<!-- wp:code -->\n<pre class="wp-block-code"><code>${escapeHtml(code.join("\n"))}</code></pre>\n<!-- /wp:code -->`);
  }
  return blocks.join("\n\n");
}

function imageBlock(
  sourceUrl: string,
  sourceAlt: string,
  resolved?: ResolvedImage,
): string {
  const url = resolved?.destinationUrl ?? sourceUrl;
  const alt = resolved?.altText || sourceAlt;
  const attrs = resolved ? ` {"id":${resolved.mediaId},"sizeSlug":"full"}` : "";
  const className = resolved ? "wp-image-" + resolved.mediaId : "";
  return `<!-- wp:image${attrs} -->\n<figure class="wp-block-image size-full"><img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}"${className ? ` class="${className}"` : ""}/></figure>\n<!-- /wp:image -->`;
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function extractImages(markdown: string): Array<{ alt: string; url: string }> {
  return [...markdown.matchAll(IMAGE_PATTERN)].map((match) => ({
    alt: match[1].trim(),
    url: match[2],
  }));
}

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstHeading(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function firstString(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function slugFromUrl(value: string): string | undefined {
  try {
    return new URL(value).pathname.split("/").filter(Boolean).at(-1);
  } catch {
    return undefined;
  }
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "untitled-post";
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function stripWrappingQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
