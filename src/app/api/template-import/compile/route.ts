import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { analyzeTemplateJson } from "@/lib/template-import/analyze";
import { compileTemplate } from "@/lib/template-import/compiler";
import { parseTemplateCompileManifest } from "@/lib/template-import/compiler/manifest";
import type { TemplateCompileBundle } from "@/lib/template-import/types";

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

  const manifestValue = formData.get("manifest");
  if (typeof manifestValue !== "string") {
    return Response.json({ error: "A mapping manifest is required." }, { status: 400 });
  }

  let manifest;
  try {
    manifest = parseTemplateCompileManifest(JSON.parse(manifestValue) as unknown);
  } catch {
    return Response.json({ error: "The mapping manifest is invalid." }, { status: 400 });
  }

  const selectedMappings = manifest.mappings.filter((mapping) => mapping.selected);
  if (selectedMappings.length === 0) {
    return Response.json({ error: "Select at least one template to compile." }, { status: 400 });
  }
  if (selectedMappings.some((mapping) => mapping.status === "blocked")) {
    return Response.json(
      { error: "Blocked mappings cannot be compiled." },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);
  if (files.length !== selectedMappings.length || files.length > MAX_FILES) {
    return Response.json(
      { error: "Upload exactly one source file for each selected mapping." },
      { status: 400 },
    );
  }
  if (files.some((file) => file.size > MAX_FILE_BYTES)) {
    return Response.json(
      { error: "Each JSON file must be 2 MB or smaller." },
      { status: 413 },
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    return Response.json(
      { error: "The upload batch must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  try {
    const sources = await Promise.all(
      files.map(async (file) => {
        if (!file.name.toLowerCase().endsWith(".json")) {
          throw new Error(`${file.name} is not a JSON file.`);
        }
        const text = await file.text();
        return {
          file,
          checksum: createHash("sha256").update(text).digest("hex"),
          document: JSON.parse(text) as unknown,
        };
      }),
    );
    const sourcesByChecksum = new Map(sources.map((source) => [source.checksum, source]));
    if (sourcesByChecksum.size !== sources.length) {
      return Response.json(
        { error: "Duplicate source files are not allowed in a compile batch." },
        { status: 400 },
      );
    }

    const pages = selectedMappings.map((mapping) => {
      const source = sourcesByChecksum.get(mapping.checksum);
      if (!source || source.file.name !== mapping.fileName) {
        throw new Error(`The source file for ${mapping.fileName} does not match its analysis.`);
      }
      const analysis = analyzeTemplateJson({
        fileName: source.file.name,
        sizeBytes: source.file.size,
        checksum: source.checksum,
        document: source.document,
      });
      return compileTemplate({ analysis, document: source.document, mapping });
    });

    const bundle: TemplateCompileBundle = {
      schemaVersion: "1",
      compiledAt: new Date().toISOString(),
      sourceManifestCreatedAt: manifest.createdAt,
      totals: {
        selected: selectedMappings.length,
        compiled: pages.filter((page) => Boolean(page.artifact)).length,
        ready: pages.filter((page) => page.status === "ready").length,
        review: pages.filter((page) => page.status === "review").length,
        blocked: pages.filter((page) => page.status === "blocked").length,
      },
      pages,
    };

    return Response.json(bundle, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The template batch could not be compiled.",
      },
      { status: 400 },
    );
  }
}
