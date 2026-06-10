import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildElevatePage } from "@/lib/builders/elevate";
import type { ElementorJSON } from "@/lib/builders/elevate/types";
import { repairElementorTextContrast } from "@/lib/elementor/contrast";
import { getInjector } from "@/lib/injection/registry";
import { DEFAULT_WP_PAGE_TEMPLATE } from "@/lib/injection/base";
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
  const wp = new WpClient(req.siteUrl);

  const allBuildNotes: string[] = [];
  const allWarnings: string[] = [];
  const deployed: DeployedPageRecord[] = [];

  // 1. Pages (content.pages is the selected set; may contain several services)
  for (const pageContent of req.content.pages) {
    const label = `Creating ${pageContent.wpTitle || pageContent.page}`;
    yield { type: "step", step: "page", status: "start", label };

    try {
      const injected = buildPage(req, pageContent);
      repairElementorTextContrast(injected.elementorData, req.brandKit.colors);
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

  // 2. Site identity
  yield* step("site-identity", "Setting site name", async () => {
    await wp.setSiteName(req.wpUsername, req.wpAppPassword, req.siteName);
  });

  // 3. Brand colors
  yield* step("brand-colors", "Setting brand colors", async () => {
    await wp.setBrandColors(
      toSystemColors(req.brandKit.colors),
      toCustomColors(req.brandKit.colors),
    );
  });

  // 4. Brand fonts
  yield* step("brand-fonts", "Setting brand fonts", async () => {
    await wp.setBrandFonts(toSystemTypography(req.brandKit.fonts));
  });

  // 5. Site logo
  if (req.brandKit.logo) {
    const logo = req.brandKit.logo;
    yield* step("logo", "Setting site logo", async () => {
      await wp.setLogo(logo.filename, logo.dataBase64);
    });
  }

  // 6. Site favicon
  if (req.brandKit.favicon) {
    const favicon = req.brandKit.favicon;
    yield* step("favicon", "Setting site favicon", async () => {
      await wp.setFavicon(favicon.filename, favicon.dataBase64);
    });
  }

  // 7. Flush Elementor CSS
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

function buildPage(
  req: DeployRequest,
  pageContent: DeployRequest["content"]["pages"][number],
): {
  page: string;
  title: string;
  slug: string;
  wpPageTemplate: string;
  elementorVersion?: string;
  elementorData: unknown[];
  buildNotes: string[];
  warnings: string[];
} {
  if (
    req.theme === "elevate" &&
    req.content.site &&
    pageContent.pageData &&
    pageContent.builderPageType
  ) {
    const built = buildElevatePage({
      pageType: pageContent.builderPageType,
      slug: pageContent.serviceSlug,
      site: req.content.site,
      pageData: pageContent.pageData,
      template: loadElevateTemplate(templateNameFor(pageContent.builderPageType)),
    });
    const templateVersion =
      typeof built.json.version === "string" ? built.json.version : undefined;
    return {
      page: pageContent.page,
      title: pageContent.wpTitle ?? titleFromPage(pageContent.page),
      slug: pageContent.slug ?? pageContent.serviceSlug ?? pageContent.page,
      wpPageTemplate: pageContent.wpPageTemplate ?? DEFAULT_WP_PAGE_TEMPLATE,
      elementorVersion: req.elementorVersion ?? templateVersion,
      elementorData: built.json.content,
      buildNotes: [...(pageContent.buildNotes ?? []), ...built.buildNotes],
      warnings: built.warnings,
    };
  }

  const injector = getInjector(req.theme);
  const injected = injector.injectPage(
    pageContent.page,
    {
      page: pageContent.page,
      wpTitle: pageContent.wpTitle,
      slug: pageContent.slug,
      wpPageTemplate: pageContent.wpPageTemplate,
      slots: pageContent.slots ?? {},
      buildNotes: pageContent.buildNotes,
    },
    {
      practiceName: req.content.practiceName,
      elementorVersion: req.elementorVersion,
    },
  );
  return injected;
}

function loadElevateTemplate(name: string): ElementorJSON {
  const file = path.join(process.cwd(), "theme-templates", "elevate", `${name}.json`);
  return JSON.parse(readFileSync(file, "utf-8")) as ElementorJSON;
}

function templateNameFor(pageType: string): string {
  if (pageType === "insurance-and-financing") return "insurance";
  return pageType;
}

function titleFromPage(page: string): string {
  return page
    .replace(/^service-page-/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
