import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  confirmContentMatch,
  listContentMatches,
  rebuildContentMatches,
} from "@/lib/content-matches/repository";

export const runtime = "nodejs";

const confirmationSchema = z.object({
  pagePlanItemId: z.string().trim().min(1).max(100),
  sourcePageId: z.string().trim().min(1).max(100).optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId } = await context.params;
    return Response.json({ matches: await listContentMatches(userId, projectId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load content matches." },
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
    return Response.json({ matches: await rebuildContentMatches(userId, projectId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not match source content." },
      { status: 400 },
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = confirmationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Choose a valid source page." }, { status: 400 });
  }
  try {
    const { projectId } = await context.params;
    return Response.json({
      matches: await confirmContentMatch(userId, projectId, parsed.data),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save the content match." },
      { status: 400 },
    );
  }
}
