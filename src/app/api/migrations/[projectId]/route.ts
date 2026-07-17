import { auth } from "@clerk/nextjs/server";
import {
  getMigrationProject,
  saveMigrationTemplateWorkspace,
} from "@/lib/migration/projects";
import { reconcileDependencyLedger } from "@/lib/migration/dependencies";
import {
  migrationCompileBundleSchema,
  migrationResolutionsSchema,
  migrationWizardWorkspaceSchema,
} from "@/lib/migration/deploy/schema";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

export async function GET(
  _req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { projectId } = await context.params;
    const project = await getMigrationProject(userId, projectId);
    return Response.json({ project });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Migration project not found." },
      { status: 404 },
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Migration workspace request exceeds the 12MB limit." },
      { status: 413 },
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const body = value as { bundle?: unknown; resolutions?: unknown; workspace?: unknown };
  const parsedBundle = body.bundle === undefined
    ? undefined
    : migrationCompileBundleSchema.safeParse(body.bundle);
  const parsedResolutions = migrationResolutionsSchema.safeParse(
    body.resolutions ?? [],
  );
  const parsedWorkspace = migrationWizardWorkspaceSchema.safeParse(body.workspace);
  if (
    (parsedBundle && !parsedBundle.success) ||
    !parsedResolutions.success ||
    !parsedWorkspace.success
  ) {
    return Response.json(
      { error: "Invalid migration workspace state." },
      { status: 400 },
    );
  }

  try {
    const { projectId } = await context.params;
    const bundle = parsedBundle?.success ? parsedBundle.data : undefined;
    const resolutions = bundle
      ? reconcileDependencyLedger(bundle, parsedResolutions.data)
      : [];
    const project = await saveMigrationTemplateWorkspace(
      userId,
      projectId,
      bundle,
      resolutions,
      parsedWorkspace.data,
    );
    return Response.json({
      project: {
        id: project.id,
        status: project.status,
        stage: project.stage,
        updatedAt: project.updatedAt,
      },
      resolutions,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save the migration workspace." },
      { status: 400 },
    );
  }
}
