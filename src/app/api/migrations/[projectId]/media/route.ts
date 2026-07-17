import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { WpClient } from "@/lib/wp/client";
import {
  getMigrationProject,
  inventoryMigrationMedia,
  parseMigrationAssets,
  saveMigrationAssets,
} from "@/lib/migration/projects";
import {
  migrateMediaAssets,
  type MediaUploadGateway,
} from "@/lib/migration/media/migrate";

export const runtime = "nodejs";
export const maxDuration = 120;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("inventory") }),
  z.object({
    action: z.literal("review"),
    updates: z.array(z.object({
      id: z.string().min(1),
      included: z.boolean().optional(),
      altText: z.string().trim().max(300).optional(),
      title: z.string().trim().max(200).optional(),
      filename: z.string().regex(/^[a-z0-9][a-z0-9-]*\.(?:jpe?g|png|webp|gif|avif)$/i).optional(),
    })).max(1000),
  }),
  z.object({ action: z.literal("migrate"), dryRun: z.boolean().default(true) }),
]);

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid media action", detail: parsed.error.issues }, { status: 400 });
  const { projectId } = await context.params;

  try {
    if (parsed.data.action === "inventory") {
      return Response.json(await inventoryMigrationMedia(userId, projectId));
    }
    const project = await getMigrationProject(userId, projectId);
    const assets = parseMigrationAssets(project.assets);
    if (parsed.data.action === "review") {
      const updates = new Map(parsed.data.updates.map((item) => [item.id, item]));
      const reviewed = assets.map((asset) => {
        const update = updates.get(asset.id);
        if (!update) return asset;
        const next = { ...asset, ...update };
        return { ...next, status: !next.included ? "skipped" as const : next.altText ? "ready" as const : "review" as const, error: undefined };
      });
      await saveMigrationAssets(userId, projectId, reviewed);
      return Response.json({ assets: reviewed });
    }
    if (!parsed.data.dryRun && !project.clientId) {
      return Response.json({ error: "Select a destination client before migrating media." }, { status: 409 });
    }
    let gateway: MediaUploadGateway = {
      upload: async () => {
        throw new Error("Dry run does not upload media.");
      },
    };
    if (!parsed.data.dryRun && project.clientId) {
      const client = await prisma.client.findFirst({ where: { id: project.clientId, createdBy: userId } });
      if (!client) return Response.json({ error: "Destination client not found." }, { status: 404 });
      const wp = new WpClient(client.wpSiteUrl);
      const password = decrypt(client.wpAppPasswordEncrypted);
      gateway = { upload: async (input) => {
        const result = await wp.uploadMedia(input, client.wpUsername, password);
        return { id: result.id, sourceUrl: result.sourceUrl, reused: result.reused };
      } };
    }
    const migrated = await migrateMediaAssets(assets, gateway, { dryRun: parsed.data.dryRun });
    await saveMigrationAssets(userId, projectId, migrated, parsed.data.dryRun ? "migration.media.dry-run" : "migration.media.migrate");
    return Response.json({ dryRun: parsed.data.dryRun, assets: migrated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Media action failed." }, { status: 400 });
  }
}
