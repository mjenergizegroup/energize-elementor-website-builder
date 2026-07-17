import type { MigrationBlogDraft } from "../types";

export interface BlogDraftGateway {
  upsertDraft(input: {
    title: string;
    slug: string;
    date?: string;
    excerpt?: string;
    content: string;
    featuredMediaId?: number;
  }): Promise<{
    id: number;
    status: string;
    url: string;
    editUrl: string;
    reused: boolean;
  }>;
}

export interface BlogMigrationResult {
  drafts: MigrationBlogDraft[];
  attempted: number;
  migrated: number;
  failed: number;
  remaining: number;
}

export async function migrateBlogDrafts(
  drafts: MigrationBlogDraft[],
  gateway: BlogDraftGateway,
  options: { dryRun?: boolean; limit?: number } = {},
): Promise<BlogMigrationResult> {
  const dryRun = options.dryRun ?? true;
  const limit = Math.min(20, Math.max(1, options.limit ?? 3));
  const output: MigrationBlogDraft[] = [];
  let attempted = 0;
  let migrated = 0;
  let failed = 0;

  for (const draft of drafts) {
    if (draft.status === "migrated" || attempted >= limit) {
      output.push(draft);
      continue;
    }
    attempted += 1;
    const validationError = validateDraft(draft);
    if (validationError) {
      output.push({ ...draft, status: "failed", error: validationError });
      failed += 1;
      continue;
    }
    if (dryRun) {
      output.push({ ...draft, status: "ready", error: undefined });
      continue;
    }
    try {
      const result = await gateway.upsertDraft({
        title: draft.title,
        slug: draft.slug,
        date: draft.date,
        excerpt: draft.excerpt,
        content: draft.gutenbergContent,
        featuredMediaId: draft.featuredMediaId,
      });
      if (result.status !== "draft") {
        throw new Error("WordPress did not retain the post as a draft.");
      }
      output.push({
        ...draft,
        status: "migrated",
        attemptCount: draft.attemptCount + 1,
        destinationPostId: result.id,
        destinationUrl: result.url,
        editUrl: result.editUrl,
        error: undefined,
      });
      migrated += 1;
    } catch (error) {
      output.push({
        ...draft,
        status: "failed",
        attemptCount: draft.attemptCount + 1,
        error: error instanceof Error ? error.message : "Blog migration failed.",
      });
      failed += 1;
    }
  }

  return {
    drafts: output,
    attempted,
    migrated,
    failed,
    remaining: output.filter((draft) => draft.status !== "migrated").length,
  };
}

function validateDraft(draft: MigrationBlogDraft): string | undefined {
  if (!draft.title.trim()) return "Post title is required.";
  if (!draft.slug.trim()) return "Post slug is required.";
  if (!draft.gutenbergContent.trim()) return "Post content is required.";
  if (draft.unresolvedImageUrls.length > 0) {
    return `${draft.unresolvedImageUrls.length} blog image(s) must be migrated before this post.`;
  }
  if (draft.featuredImageUrl && !draft.featuredMediaId) {
    return "The featured image must be migrated before this post.";
  }
  return undefined;
}
