import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  createMigrationProject,
  listMigrationProjects,
} from "@/lib/migration/projects";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url().optional(),
  clientId: z.string().min(1).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await listMigrationProjects(userId);
  return Response.json({ projects });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", detail: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const project = await createMigrationProject(userId, parsed.data);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create project." },
      { status: 400 },
    );
  }
}
