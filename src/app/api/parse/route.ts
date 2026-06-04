import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { parseContent, ParserNotImplementedError } from "@/lib/parser";

export const runtime = "nodejs";

const bodySchema = z.object({
  theme: z.string().min(1),
  markdown: z.string().min(1).max(1_048_576), // 1MB cap per brief
  // Optional hint; the parser reads every page present in the markdown.
  pages: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return Response.json(
      { error: "Invalid request", detail: e instanceof z.ZodError ? e.issues : String(e) },
      { status: 400 },
    );
  }

  try {
    const content = parseContent(body);
    return Response.json({ content });
  } catch (e) {
    if (e instanceof ParserNotImplementedError) {
      return Response.json({ error: e.message, code: "parser_pending" }, { status: 501 });
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 422 },
    );
  }
}
