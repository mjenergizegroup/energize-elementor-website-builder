import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import {
  analyzeTemplateJson,
  invalidTemplateAnalysis,
} from "@/lib/template-import/analyze";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BATCH_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected a multipart form upload." },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "Select at least one JSON file." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return Response.json(
      { error: `Upload no more than ${MAX_FILES} files per batch.` },
      { status: 400 },
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    return Response.json(
      { error: "The upload batch must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const analyses = await Promise.all(
    files.map(async (file) => {
      const text = await file.text();
      const checksum = createHash("sha256").update(text).digest("hex");

      if (!file.name.toLowerCase().endsWith(".json")) {
        return invalidTemplateAnalysis({
          fileName: file.name,
          sizeBytes: file.size,
          checksum,
          message: "Only .json files are supported in this importer.",
        });
      }
      if (file.size > MAX_FILE_BYTES) {
        return invalidTemplateAnalysis({
          fileName: file.name,
          sizeBytes: file.size,
          checksum,
          message: "This file is larger than the 2 MB per-file limit.",
        });
      }

      try {
        return analyzeTemplateJson({
          fileName: file.name,
          sizeBytes: file.size,
          checksum,
          document: JSON.parse(text) as unknown,
        });
      } catch (error) {
        return invalidTemplateAnalysis({
          fileName: file.name,
          sizeBytes: file.size,
          checksum,
          message: error instanceof Error ? error.message : "The file could not be parsed.",
        });
      }
    }),
  );

  return Response.json(
    { analyses },
    { headers: { "Cache-Control": "no-store" } },
  );
}
