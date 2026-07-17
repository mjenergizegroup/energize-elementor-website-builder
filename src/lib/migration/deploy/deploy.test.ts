import assert from "node:assert/strict";
import type { TemplateCompileBundle } from "@/lib/template-import/types";
import {
  prepareMigrationDeployment,
  runMigrationDeployment,
} from "./orchestrate";
import { preflightMigrationDeployment, validateArtifact } from "./preflight";
import { buildDependencyLedger } from "../dependencies";

function bundle(): TemplateCompileBundle {
  const compiledAt = "2026-07-17T12:00:00.000Z";
  return {
    schemaVersion: "1",
    compiledAt,
    sourceManifestCreatedAt: compiledAt,
    totals: { selected: 2, compiled: 2, ready: 2, review: 0, blocked: 0 },
    pages: [
      compiledPage("home", "Home", "home", "a1b2c3d4"),
      compiledPage("about", "About", "about", "b1c2d3e4"),
    ],
  };
}

function compiledPage(
  analysisId: string,
  title: string,
  slug: string,
  elementId: string,
): TemplateCompileBundle["pages"][number] {
  return {
    analysisId,
    fileName: `${slug}.json`,
    checksum: "a".repeat(64),
    status: "ready",
    deployable: true,
    targetKind: "wp-page",
    mapping: { role: "custom", title, slug, selected: true },
    compiler: { id: "elementor-v3-portable", version: "1" },
    transformations: {
      elementIdsRegenerated: 1,
      duplicateIdsResolved: 0,
      mediaIdsCleared: 0,
      globalReferencesPreserved: 0,
      dynamicBindingsPreserved: 0,
      unsupportedWidgetsPreserved: 0,
    },
    pending: {
      externalHosts: [],
      customGlobalIds: [],
      plugins: [],
      unsupportedWidgets: [],
      shortcodes: [],
    },
    warnings: [],
    wordpress: { status: "draft", pageTemplate: "elementor_header_footer" },
    artifact: {
      version: "0.4",
      content: [
        {
          id: elementId,
          elType: "widget",
          widgetType: "heading",
          settings: { title },
          elements: [],
        },
      ],
    },
  };
}

async function main() {
  const source = bundle();
  const preflight = preflightMigrationDeployment(source, []);
  assert.equal(preflight.ready, true);
  assert.equal(preflight.pages.length, 2);
  assert.equal(
    (preflight.pages[0].elementorData[0] as { widgetType: string }).widgetType,
    "e-heading",
  );
  assert.equal(preflight.pages[0].elementorVersion, "4.1.1");
  const injectedPreflight = preflightMigrationDeployment(source, [], [
    contentMapping("home", "Destination Home"),
    contentMapping("about", "Destination About"),
  ]);
  assert.equal(injectedPreflight.ready, true);
  assert.match(
    JSON.stringify(injectedPreflight.pages[0].elementorData),
    /Destination Home/,
  );
  assert.doesNotMatch(
    JSON.stringify(injectedPreflight.pages[0].elementorData),
    /"Home"/,
  );

  const mediaBundle = bundle();
  mediaBundle.pages = [mediaBundle.pages[0]];
  mediaBundle.totals = {
    selected: 1,
    compiled: 1,
    ready: 0,
    review: 1,
    blocked: 0,
  };
  mediaBundle.pages[0].status = "review";
  mediaBundle.pages[0].transformations.mediaIdsCleared = 1;
  const widget = mediaBundle.pages[0].artifact?.content as Array<{
    widgetType: string;
    settings: Record<string, unknown>;
  }>;
  widget[0].widgetType = "image";
  widget[0].settings.image = {
    url: "https://source.example.com/photo.jpg",
    id: "",
  };
  assert.equal(preflightMigrationDeployment(mediaBundle, []).ready, false);
  const mediaResolution = buildDependencyLedger(mediaBundle)[0];
  const mappedPreflight = preflightMigrationDeployment(mediaBundle, [
    {
      ...mediaResolution,
      status: "resolved",
      resolution: {
        mappings: [
          {
            sourceUrl: "https://source.example.com/photo.jpg",
            destinationUrl: "https://wp.example.com/photo.jpg",
            destinationMediaId: 42,
          },
        ],
      },
    },
  ]);
  assert.equal(mappedPreflight.ready, true);
  assert.match(
    JSON.stringify(mappedPreflight.pages[0].elementorData),
    /https:\/\/wp\.example\.com\/photo\.jpg/,
  );
  assert.doesNotMatch(
    JSON.stringify(mappedPreflight.pages[0].elementorData),
    /source\.example\.com/,
  );

  const prepared = prepareMigrationDeployment(
    source,
    [],
    new Date("2026-07-17T12:00:00.000Z"),
  );
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.items.every((item) => item.status === "ready"), true);

  let calls = 0;
  const dryRun = await runMigrationDeployment(
    source,
    [],
    prepared,
    {
      upsertDraft: async () => {
        calls += 1;
        throw new Error("dry run must not write");
      },
    },
    { dryRun: true },
  );
  assert.equal(calls, 0);
  assert.equal(dryRun.status, "ready");
  assert.equal(dryRun.events.filter((event) => event.status === "ok").length, 3);

  let failAbout = true;
  const gateway = {
    upsertDraft: async (input: { slug: string }) => {
      calls += 1;
      if (input.slug === "about" && failAbout) {
        throw new Error("simulated timeout");
      }
      return {
        id: input.slug === "home" ? 10 : 11,
        status: "draft",
        editUrl: `https://wp.example.com/edit/${input.slug}`,
        viewUrl: `https://wp.example.com/?p=${input.slug}`,
        reused: input.slug === "about",
      };
    },
  };
  const partial = await runMigrationDeployment(source, [], dryRun, gateway, {
    dryRun: false,
  });
  assert.equal(partial.status, "partial");
  assert.equal(partial.items[0].status, "draft");
  assert.equal(partial.items[1].status, "failed");
  assert.match(partial.items[1].error ?? "", /timeout/);

  failAbout = false;
  const recovered = await runMigrationDeployment(source, [], partial, gateway, {
    dryRun: false,
    retryFailedOnly: true,
  });
  assert.equal(recovered.status, "complete");
  assert.equal(recovered.items[0].attemptCount, 1);
  assert.equal(recovered.items[1].attemptCount, 2);
  assert.equal(recovered.items[1].status, "draft");
  assert.match(recovered.items[1].editUrl ?? "", /about/);

  const invalid = structuredClone(source);
  invalid.pages[0].artifact = {
    content: [
      { id: "bad", elType: "widget", settings: { api_key: "secret" } },
    ],
  };
  const errors = validateArtifact(invalid.pages[0].artifact);
  assert.ok(errors.some((error) => /credential-like/.test(error)));
  assert.ok(errors.some((error) => /8-character/.test(error)));
  assert.equal(preflightMigrationDeployment(invalid, []).ready, false);

  const themeBuilder = bundle();
  themeBuilder.pages[0].targetKind = "elementor-theme-template";
  assert.match(
    preflightMigrationDeployment(themeBuilder, []).blockers.join(" "),
    /Theme Builder adapter/,
  );

  console.log("migration deployment checks passed");
}

function contentMapping(analysisId: string, text: string) {
  return {
    analysisId,
    content: {
      schemaVersion: "1" as const,
      sourcePageId: `${analysisId}-content`,
      title: text,
      slug: analysisId,
      slots: [
        {
          id: `${analysisId}-heading`,
          kind: "heading" as const,
          text,
          level: 1 as const,
        },
      ],
    },
  };
}

void main();
