import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { analyzeTemplateJson } from "@/lib/template-import/analyze";
import {
  createLayoutTemplate,
  listLayoutTemplates,
  listReadyLayouts,
} from "@/lib/layouts/repository";
import { LAYOUT_CATEGORIES } from "@/lib/layouts/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const categoryValues = LAYOUT_CATEGORIES.map((item) => item.value) as [
  (typeof LAYOUT_CATEGORIES)[number]["value"],
  ...(typeof LAYOUT_CATEGORIES)[number]["value"][],
];
const formSchema = z.object({
  friendlyName: z.string().trim().min(2).max(100),
  category: z.enum(categoryValues),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const readyOnly = new URL(req.url).searchParams.get("ready") === "1";
  const layouts = readyOnly
    ? await listReadyLayouts(userId)
    : await listLayoutTemplates(userId);
  return Response.json({ layouts }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Choose a JSON layout file." }, { status: 400 });
  }
  const parsed = formSchema.safeParse({
    friendlyName: formData.get("friendlyName"),
    category: formData.get("category"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Add a friendly layout name and category." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a JSON layout file." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".json")) {
    return Response.json({ error: "Choose an Elementor JSON export." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return Response.json(
      { error: "The layout file must be smaller than 2 MB." },
      { status: 413 },
    );
  }

  try {
    const text = await file.text();
    const checksum = createHash("sha256").update(text).digest("hex");
    const document = JSON.parse(text) as unknown;
    const analysis = analyzeTemplateJson({
      fileName: file.name,
      sizeBytes: file.size,
      checksum,
      document,
    });
    const layout = await createLayoutTemplate({
      userId,
      friendlyName: parsed.data.friendlyName,
      category: parsed.data.category,
      fileName: file.name,
      checksum,
      document,
      analysis,
    });
    return Response.json({ layout }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "This layout file could not be prepared safely.",
      },
      { status: 400 },
    );
  }
}
