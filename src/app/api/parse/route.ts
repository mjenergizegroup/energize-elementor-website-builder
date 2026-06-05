import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { parse, ParseError } from "@/lib/parser";

export const runtime = "nodejs";

const bodySchema = z.object({
  theme: z.string().min(1).optional(),
  markdown: z.string().min(1).max(1_048_576), // 1MB cap per brief
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
    const result = parse(body.markdown);
    return Response.json({ result });
  } catch (e) {
    if (e instanceof ParseError) {
      return Response.json({ error: e.message, code: "parse_error" }, { status: 422 });
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 422 },
    );
  }
}
