import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { WpClient } from "@/lib/wp/client";
import { buildBlogDrafts } from "@/lib/migration/blogs/convert";
import {
  migrateBlogDrafts,
  type BlogDraftGateway,
} from "@/lib/migration/blogs/migrate";
import {
  getMigrationProject,
  parseMigrationAssets,
  parseMigrationBlogDrafts,
  parseMigrationSourcePages,
  saveMigrationBlogDrafts,
} from "@/lib/migration/projects";

export const runtime = "nodejs";
export const maxDuration = 120;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({
    action: z.literal("migrate"),
    dryRun: z.boolean().default(true),
    limit: z.number().int().min(1).max(20).default(3),
  }),
]);

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid blog action", detail: parsed.error.issues },
      { status: 400 },
    );
  }
  const { projectId } = await context.params;

  try {
    const project = await getMigrationProject(userId, projectId);
    if (parsed.data.action === "prepare") {
      const drafts = buildBlogDrafts(
        parseMigrationSourcePages(project.blogPosts),
        parseMigrationAssets(project.assets),
      );
      await saveMigrationBlogDrafts(userId, projectId, drafts);
      return Response.json({ drafts });
    }

    const drafts = parseMigrationBlogDrafts(project.blogDrafts);
    if (drafts.length === 0) {
      return Response.json(
        { error: "Prepare blog drafts before running migration." },
        { status: 409 },
      );
    }
    if (!parsed.data.dryRun && !project.clientId) {
      return Response.json(
        { error: "Select a destination client before migrating blogs." },
        { status: 409 },
      );
    }

    let gateway: BlogDraftGateway = {
      upsertDraft: async () => {
        throw new Error("Dry run does not create WordPress posts.");
      },
    };
    if (!parsed.data.dryRun && project.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: project.clientId, createdBy: userId },
      });
      if (!client) {
        return Response.json(
          { error: "Destination client not found." },
          { status: 404 },
        );
      }
      const wordpress = new WpClient(client.wpSiteUrl);
      const password = decrypt(client.wpAppPasswordEncrypted);
      gateway = {
        upsertDraft: (input) =>
          wordpress.upsertBlogDraft(input, client.wpUsername, password),
      };
    }

    const result = await migrateBlogDrafts(drafts, gateway, {
      dryRun: parsed.data.dryRun,
      limit: parsed.data.limit,
    });
    await saveMigrationBlogDrafts(
      userId,
      projectId,
      result.drafts,
      parsed.data.dryRun
        ? "migration.blogs.dry-run"
        : "migration.blogs.migrate",
    );
    return Response.json({ dryRun: parsed.data.dryRun, ...result });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Blog migration failed.",
      },
      { status: 400 },
    );
  }
}
