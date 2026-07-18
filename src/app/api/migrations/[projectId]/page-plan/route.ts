import { auth } from "@clerk/nextjs/server";
import { listPagePlan, savePagePlan } from "@/lib/page-plan/repository";
import {
  hasUniquePagePlanSlugs,
  pagePlanRequestSchema,
} from "@/lib/page-plan/schema";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId } = await context.params;
    return Response.json({ items: await listPagePlan(userId, projectId) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Page Plan not found." },
      { status: 404 },
    );
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = pagePlanRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "The Page Plan contains invalid page details." }, { status: 400 });
  }
  if (!hasUniquePagePlanSlugs(parsed.data.items)) {
    return Response.json({ error: "Every page must have a unique URL." }, { status: 400 });
  }
  try {
    const { projectId } = await context.params;
    return Response.json({ items: await savePagePlan(userId, projectId, parsed.data.items) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save the Page Plan." },
      { status: 400 },
    );
  }
}
