import { auth } from "@clerk/nextjs/server";
import { getLayoutPreview } from "@/lib/layouts/repository";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ layoutId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { layoutId } = await context.params;
    const preview = await getLayoutPreview(userId, layoutId);
    return Response.json(
      { preview },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Preview not found." },
      { status: 404 },
    );
  }
}
