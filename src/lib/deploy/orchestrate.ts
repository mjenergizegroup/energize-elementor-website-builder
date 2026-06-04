import "server-only";
import { getInjector } from "@/lib/injection/registry";
import { WpClient } from "@/lib/wp/client";
import {
  toCustomColors,
  toSystemColors,
  toSystemTypography,
} from "@/lib/wp/brand";
import type {
  DeployedPageRecord,
  DeployEvent,
  DeployRequest,
} from "./types";

// Pure orchestration: no database access here so it stays easy to test. The
// route handler wraps this with auth, rate limiting, persistence, and audit
// logging. Yields a DeployEvent per step so the UI can render live progress.
export async function* runDeploy(
  req: DeployRequest,
): AsyncGenerator<DeployEvent, void, void> {
  const injector = getInjector(req.theme);
  const wp = new WpClient(req.siteUrl);

  const allBuildNotes: string[] = [];
  const allWarnings: string[] = [];
  const deployed: DeployedPageRecord[] = [];

  // 1. Pages (content.pages is the selected set; may contain several services)
  for (const pageContent of req.content.pages) {
    const label = `Creating ${pageContent.wpTitle || pageContent.page}`;
    yield { type: "step", step: "page", status: "start", label };

    try {
      const injected = injector.injectPage(pageContent.page, pageContent, {
        practiceName: req.content.practiceName,
        elementorVersion: req.elementorVersion,
      });
      allBuildNotes.push(...injected.buildNotes);
      allWarnings.push(...injected.warnings);

      const result = await wp.createPage({
        title: injected.title,
        slug: injected.slug,
        template: injected.wpPageTemplate,
        elementorData: injected.elementorData,
        elementorVersion: injected.elementorVersion,
        status: "draft",
      });

      deployed.push({
        page: pageContent.page,
        title: injected.title,
        wpPageId: result.id,
        editUrl: result.editUrl,
        viewUrl: result.viewUrl,
        status: "draft",
      });

      yield {
        type: "step",
        step: "page",
        status: "ok",
        label,
        data: {
          page: pageContent.page,
          title: injected.title,
          wpPageId: result.id,
          editUrl: result.editUrl,
          viewUrl: result.viewUrl,
        },
      };
    } catch (e) {
      yield {
        type: "step",
        step: "page",
        status: "fail",
        label,
        message: e instanceof Error ? e.message : "Page creation failed",
      };
    }
  }

  // 2. Brand colors
  yield* step("brand-colors", "Setting brand colors", async () => {
    await wp.setBrandColors(
      toSystemColors(req.brandKit.colors),
      toCustomColors(req.brandKit.colors),
    );
  });

  // 3. Brand fonts
  yield* step("brand-fonts", "Setting brand fonts", async () => {
    await wp.setBrandFonts(toSystemTypography(req.brandKit.fonts));
  });

  // 4. Logo (optional)
  if (req.brandKit.logo) {
    const logo = req.brandKit.logo;
    yield* step("logo", "Uploading logo", async () => {
      await wp.setLogo(logo.filename, logo.dataBase64);
    });
  }

  // 5. Favicon (optional)
  if (req.brandKit.favicon) {
    const favicon = req.brandKit.favicon;
    yield* step("favicon", "Uploading favicon", async () => {
      await wp.setFavicon(favicon.filename, favicon.dataBase64);
    });
  }

  // 6. Flush Elementor CSS
  yield* step("flush-css", "Flushing Elementor CSS cache", async () => {
    await wp.flushCss();
  });

  yield {
    type: "done",
    status: "ok",
    label: "Deploy complete",
    buildNotes: dedupe(allBuildNotes),
    warnings: dedupe(allWarnings),
    data: undefined,
  };
}

// Helper that emits start/ok or start/fail around an action.
async function* step(
  stepName: DeployEvent["step"],
  label: string,
  action: () => Promise<void>,
): AsyncGenerator<DeployEvent, void, void> {
  yield { type: "step", step: stepName, status: "start", label };
  try {
    await action();
    yield { type: "step", step: stepName, status: "ok", label };
  } catch (e) {
    yield {
      type: "step",
      step: stepName,
      status: "fail",
      label,
      message: e instanceof Error ? e.message : "Step failed",
    };
  }
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}
