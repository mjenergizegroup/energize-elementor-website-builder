import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { resolveClient } from "@/lib/clients";
import { decrypt } from "@/lib/crypto";
import { checkDeployRateLimit } from "@/lib/rate-limit";
import { WpClient } from "@/lib/wp/client";
import { reconcileDependencyLedger } from "@/lib/migration/dependencies";
import {
  parseMigrationCompileBundle,
  parseMigrationDeployment,
  parseMigrationResolutions,
  getMigrationProject,
  saveMigrationDeploymentPlan,
  saveMigrationDeploymentRecord,
} from "@/lib/migration/projects";
import {
  prepareMigrationDeployment,
  runMigrationDeployment,
} from "@/lib/migration/deploy/orchestrate";
import { preflightMigrationDeployment } from "@/lib/migration/deploy/preflight";
import {
  migrationCompileBundleSchema,
  migrationDeployActionSchema,
} from "@/lib/migration/deploy/schema";
import type {
  MigrationDeploymentRecord,
  MigrationPageGateway,
} from "@/lib/migration/deploy/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

export async function POST(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Migration deployment request exceeds the 12MB limit." },
      { status: 413 },
    );
  }
  const parsed = migrationDeployActionSchema.safeParse(parseJson(raw));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid migration deployment action", detail: parsed.error.issues },
      { status: 400 },
    );
  }
  const { projectId } = await context.params;

  try {
    const project = await getMigrationProject(userId, projectId);
    if (parsed.data.action === "prepare") {
      let clientId = project.clientId ?? undefined;
      if (!clientId) {
        if (!parsed.data.destination) {
          return Response.json(
            { error: "A saved client or destination is required." },
            { status: 409 },
          );
        }
        const client = await resolveClient(userId, undefined, {
          ...parsed.data.destination,
          theme: undefined,
        });
        clientId = client.id;
      }
      const reconciledResolutions = reconcileDependencyLedger(
        parsed.data.bundle,
        parsed.data.resolutions,
      );
      const deployment = prepareMigrationDeployment(
        parsed.data.bundle,
        reconciledResolutions,
      );
      await saveMigrationDeploymentPlan(
        userId,
        projectId,
        parsed.data.bundle,
        reconciledResolutions,
        deployment,
        clientId,
      );
      return Response.json({ deployment });
    }

    const storedBundle = parseMigrationCompileBundle(project.selectedTemplates);
    const bundle = migrationCompileBundleSchema.parse(storedBundle);
    const resolutions = parseMigrationResolutions(project.resolutions);
    if (parsed.data.action === "preflight") {
      return Response.json({
        preflight: preflightMigrationDeployment(bundle, resolutions),
      });
    }

    const previous = parseMigrationDeployment(project.deployment);
    if (!previous) {
      return Response.json(
        { error: "Prepare the migration deployment before running it." },
        { status: 409 },
      );
    }
    if (!parsed.data.dryRun && !project.clientId) {
      return Response.json(
        { error: "Select a destination client before deployment." },
        { status: 409 },
      );
    }

    let buildId: string | undefined;
    let gateway: MigrationPageGateway = {
      upsertDraft: async () => {
        throw new Error("Dry run does not create WordPress pages.");
      },
    };
    if (!parsed.data.dryRun && project.clientId) {
      const rate = await checkDeployRateLimit(userId);
      if (!rate.allowed) {
        return Response.json(
          { error: `Rate limit reached (${rate.max} deploys per minute).` },
          { status: 429 },
        );
      }
      const client = await prisma.client.findFirst({
        where: { id: project.clientId, createdBy: userId },
      });
      if (!client) {
        return Response.json(
          { error: "Destination client not found." },
          { status: 404 },
        );
      }
      const build = await prisma.build.create({
        data: {
          clientId: client.id,
          status: "in_progress",
          deployedBy: userId,
        },
        select: { id: true },
      });
      buildId = build.id;
      await audit(userId, "migration.deploy.start", client.id, {
        migrationProjectId: projectId,
        buildId,
        retryFailedOnly: parsed.data.retryFailedOnly,
      });
      const wordpress = new WpClient(client.wpSiteUrl);
      const password = decrypt(client.wpAppPasswordEncrypted);
      const connection = await wordpress.checkConnection(
        client.wpUsername,
        password,
      );
      if (!connection.ok) {
        const failed = connectionFailure(previous, buildId, connection.detail);
        await finalizeBuild(buildId, failed);
        await saveMigrationDeploymentRecord(
          userId,
          projectId,
          failed,
          "migration.deploy.failed",
        );
        return Response.json({ deployment: failed }, { status: 409 });
      }
      gateway = {
        upsertDraft: (input) =>
          wordpress.upsertCompiledDraft(input, client.wpUsername, password),
      };
    }

    const deployment = await runMigrationDeployment(
      bundle,
      resolutions,
      previous,
      gateway,
      {
        dryRun: parsed.data.dryRun,
        retryFailedOnly: parsed.data.retryFailedOnly,
        buildId,
      },
    );
    if (buildId) await finalizeBuild(buildId, deployment);
    await saveMigrationDeploymentRecord(
      userId,
      projectId,
      deployment,
      parsed.data.dryRun
        ? "migration.deploy.dry-run"
        : "migration.deploy.finish",
    );
    return Response.json({ deployment });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Migration deployment failed.",
      },
      { status: 400 },
    );
  }
}

function connectionFailure(
  previous: MigrationDeploymentRecord,
  buildId: string,
  message: string,
): MigrationDeploymentRecord {
  const at = new Date().toISOString();
  return {
    ...previous,
    status: "failed",
    dryRun: false,
    buildId,
    attemptCount: previous.attemptCount + 1,
    startedAt: at,
    completedAt: at,
    events: [
      ...previous.events,
      {
        at,
        status: "fail",
        label: "WordPress connection failed",
        message,
      },
    ],
  };
}

async function finalizeBuild(
  buildId: string,
  deployment: MigrationDeploymentRecord,
) {
  const status =
    deployment.status === "complete"
      ? "success"
      : deployment.status === "partial"
        ? "partial"
        : "failed";
  const pages = deployment.items
    .filter((item) => item.status === "draft" && item.wpPageId)
    .map((item) => ({
      page: item.slug,
      title: item.title,
      wpPageId: item.wpPageId,
      editUrl: item.editUrl,
      viewUrl: item.viewUrl,
      status: "draft",
      kind: "content",
    }));
  await prisma.build.update({
    where: { id: buildId },
    data: {
      status,
      deployedAt: new Date(),
      pagesDeployed: pages,
      errorLog: JSON.stringify({
        migrationProject: true,
        warnings: deployment.warnings,
        events: deployment.events,
      }),
    },
    select: { id: true },
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
