import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { resolveClient } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { checkDeployRateLimit } from "@/lib/rate-limit";
import { validateBrandKitAssets } from "@/lib/security/uploads";
import { prepareProjectDrafts } from "@/lib/prepared-drafts/repository";
import { containsClassicElementorContent } from "@/lib/migration/content/inject-elementor-v3";
import { bridgeSupportsPreservedV3Layouts, WpClient } from "@/lib/wp/client";
import {
  createPreparedBuildPlan,
  runPreparedBuildPlan,
  summarizePreparedBuild,
} from "@/lib/website-builds/orchestrate";
import {
  loadPreparedBuildPlan,
  loadPreparedBuildSource,
  savePreparedBuildPlan,
} from "@/lib/website-builds/repository";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

const assetSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  dataBase64: z.string().min(1).max(4_000_000),
});

const destinationSchema = z.object({
  clientId: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  wpSiteUrl: z.string().url().max(5_000).refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS WordPress URL."),
  wpUsername: z.string().trim().min(1).max(500),
  wpAppPassword: z.string().max(500).optional(),
  brandKit: z.object({
    colors: z.object({
      primary: z.string().max(100),
      secondary: z.string().max(100),
      accent: z.string().max(100),
      text: z.string().max(100),
      background: z.string().max(100),
      highlight: z.string().max(100).optional(),
    }),
    fonts: z.object({
      heading: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(200),
    }),
    logo: assetSchema.optional(),
    favicon: assetSchema.optional(),
  }),
});

const requestSchema = z.object({
  action: z.enum(["dry-run", "execute", "retry"]),
  destination: destinationSchema,
});

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
    return Response.json({ error: "Website build request exceeds the 6MB limit." }, { status: 413 });
  }
  const parsed = requestSchema.safeParse(parseJson(raw));
  if (!parsed.success) {
    return Response.json(
      { error: "Check the WordPress destination and brand details.", detail: parsed.error.issues },
      { status: 400 },
    );
  }
  const { projectId } = await context.params;
  const { action, destination } = parsed.data;

  try {
    validateBrandKitAssets(destination.brandKit);
    if (action === "dry-run") {
      await prepareProjectDrafts(userId, projectId);
      const source = await loadPreparedBuildSource(userId, projectId);
      const plan = createPreparedBuildPlan({
        id: randomUUID(),
        projectId,
        pages: source.pages,
        workspaceChecksum: source.workspaceChecksum,
        destination: withoutPassword(destination),
      });
      await savePreparedBuildPlan(
        userId,
        projectId,
        plan,
        "website-build.dry-run",
      );
      return Response.json({ plan: summarizePreparedBuild(plan) });
    }

    const [plan, source] = await Promise.all([
      loadPreparedBuildPlan(userId, projectId),
      loadPreparedBuildSource(userId, projectId),
    ]);
    if (!plan) {
      return Response.json({ error: "Wait for the automatic final check before creating drafts." }, { status: 409 });
    }
    const current = createPreparedBuildPlan({
      id: plan.id,
      projectId,
      pages: source.pages,
      workspaceChecksum: source.workspaceChecksum,
      destination: withoutPassword(destination),
      now: new Date(plan.preparedAt),
    });
    if (current.inputChecksum !== plan.inputChecksum) {
      return Response.json(
        { error: "The Page Plan, content, brand, or destination changed. Run the automatic final check again." },
        { status: 409 },
      );
    }
    if (plan.status === "complete") {
      return Response.json({ plan: summarizePreparedBuild(plan) });
    }
    if (action === "retry" && plan.status !== "partial" && plan.status !== "failed") {
      return Response.json({ error: "There are no failed drafts to retry." }, { status: 409 });
    }
    if (plan.blockers.length > 0) {
      return Response.json({ error: plan.blockers.join(" "), plan: summarizePreparedBuild(plan) }, { status: 409 });
    }

    const rate = await checkDeployRateLimit(userId);
    if (!rate.allowed) {
      return Response.json(
        { error: `Rate limit reached (${rate.max} builds per minute). Try again shortly.` },
        { status: 429 },
      );
    }
    const client = await resolveClient(userId, source.clientId ?? destination.clientId, {
      name: destination.name,
      slug: destination.slug,
      wpSiteUrl: destination.wpSiteUrl,
      wpUsername: destination.wpUsername,
      wpAppPassword: destination.wpAppPassword,
      brandKit: destination.brandKit,
    });
    const build = await prisma.build.create({
      data: { clientId: client.id, status: "in_progress", deployedBy: userId },
      select: { id: true },
    });
    await audit(userId, "website-build.start", client.id, {
      migrationProjectId: projectId,
      planId: plan.id,
      buildId: build.id,
      retryFailedOnly: action === "retry",
    });

    const wordpress = new WpClient(client.wpSiteUrl);
    const requiresPreservedV3 = source.pages.some((page) =>
      containsClassicElementorContent(page.artifact),
    );
    const result = await runPreparedBuildPlan(
      plan,
      source.pages,
      {
        prepareDestination: async () => {
          const connection = await wordpress.checkConnection(client.wpUsername, client.appPassword);
          if (!connection.ok) throw new Error(connection.detail);
          if (
            requiresPreservedV3 &&
            !bridgeSupportsPreservedV3Layouts(connection.bridgeVersion)
          ) {
            throw new Error(
              "This WordPress site needs the v2.3.0 WPCode Bridge before it can preserve the selected layout design. Replace the bridge snippet and retry. No drafts were created.",
            );
          }
          await wordpress.setSiteName(client.wpUsername, client.appPassword, client.name);
        },
        applyBrand: async () => {
          await wordpress.syncAtomicFoundation(client.wpUsername, client.appPassword, client.brandKit);
          if (client.brandKit.logo) {
            await wordpress.setLogo(client.brandKit.logo.filename, client.brandKit.logo.dataBase64);
          }
          if (client.brandKit.favicon) {
            await wordpress.setFavicon(client.brandKit.favicon.filename, client.brandKit.favicon.dataBase64);
          }
        },
        upsertDraft: (input) =>
          wordpress.upsertCompiledDraft(input, client.wpUsername, client.appPassword),
      },
      {
        retryFailedOnly: action === "retry",
        buildId: build.id,
      },
    );
    await finalizeBuild(build.id, result);
    await savePreparedBuildPlan(
      userId,
      projectId,
      result,
      action === "retry" ? "website-build.retry" : "website-build.finish",
      client.id,
    );
    return Response.json({ plan: summarizePreparedBuild(result) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Website draft creation failed." },
      { status: 400 },
    );
  }
}

async function finalizeBuild(
  buildId: string,
  plan: Awaited<ReturnType<typeof runPreparedBuildPlan>>,
) {
  const status =
    plan.status === "complete"
      ? "success"
      : plan.status === "partial"
        ? "partial"
        : "failed";
  await prisma.build.update({
    where: { id: buildId },
    data: {
      status,
      deployedAt: new Date(),
      pagesDeployed: plan.items
        .filter((item) => item.status === "draft" && item.wpPageId)
        .map((item) => ({
          page: item.slug,
          title: item.title,
          wpPageId: item.wpPageId,
          editUrl: item.editUrl,
          viewUrl: item.viewUrl,
          status: "draft",
          kind: "content",
        })),
      errorLog: JSON.stringify({
        preparedPagePlan: true,
        planId: plan.id,
        warnings: plan.warnings,
        events: plan.events,
      }),
    },
    select: { id: true },
  });
}

function withoutPassword(destination: z.infer<typeof destinationSchema>) {
  return {
    clientId: destination.clientId,
    name: destination.name,
    slug: destination.slug,
    wpSiteUrl: destination.wpSiteUrl,
    wpUsername: destination.wpUsername,
    brandKit: destination.brandKit,
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
