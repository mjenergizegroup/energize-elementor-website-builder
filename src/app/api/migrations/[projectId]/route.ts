import { auth } from "@clerk/nextjs/server";
import { getMigrationProject } from "@/lib/migration/projects";

export const runtime = "nodejs";

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
