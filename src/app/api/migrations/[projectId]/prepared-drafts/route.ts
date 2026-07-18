import { auth } from "@clerk/nextjs/server";
import {
  listPreparedDrafts,
  prepareProjectDrafts,
} from "@/lib/prepared-drafts/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId } = await context.params;
    return Response.json({ drafts: await listPreparedDrafts(userId, projectId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load prepared drafts." },
      { status: 404 },
    );
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId } = await context.params;
    return Response.json({ drafts: await prepareProjectDrafts(userId, projectId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not prepare drafts." },
      { status: 400 },
    );
  }
}
