import "server-only";
import {
  accessibilityReportToWarnings,
  createAccessibilityReport,
  repairElementorHeadingStructure,
  type AccessibilityPageInput,
} from "@/lib/accessibility/audit";
import {
  buildAtomicPage,
  type AtomicVisualPreset,
} from "@/lib/elementor/atomic/page-builder";
import { DEFAULT_WP_PAGE_TEMPLATE } from "@/lib/injection/base";
import { WpClient } from "@/lib/wp/client";
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
  const accessibilityPages: AccessibilityPageInput[] = [];
  let accessibilityReport: ReturnType<typeof createAccessibilityReport> | undefined;

  yield {
    type: "step",
    step: "atomic-foundation",
    status: "start",
    label: "Validating and applying Atomic Foundation",
  };
  try {
    await wp.syncAtomicFoundation(
      req.wpUsername,
      req.wpAppPassword,
      req.brandKit,
    );
    yield {
      type: "step",
      step: "atomic-foundation",
      status: "ok",
      label: "Validating and applying Atomic Foundation",
    };
  } catch (error) {
    yield {
      type: "fatal",
      step: "atomic-foundation",
      status: "fail",
      label: "Atomic Foundation is not ready",
      message:
        error instanceof Error ? error.message : "Atomic Foundation check failed",
    };
    return;
  }

  if (req.deployMode === "pages") {
    // 1. Pages (content.pages is the selected set; may contain several services)
    for (const pageContent of req.content.pages) {
      const label = `Creating ${pageContent.wpTitle || pageContent.page}`;
      yield { type: "step", step: "page", status: "start", label };

      try {
        const injected = buildPage(req, pageContent);
        repairElementorHeadingStructure(injected.elementorData);
        allBuildNotes.push(...injected.buildNotes);
        allWarnings.push(...injected.warnings);
        accessibilityPages.push({
          page: injected.slug,
          title: injected.title,
          elementorData: injected.elementorData,
        });

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
          kind: "content",
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

    yield {
      type: "step",
      step: "accessibility-qa",
      status: "start",
      label: "Running accessibility QA",
    };
    accessibilityReport = createAccessibilityReport({
      content: req.content,
      colors: req.brandKit.colors,
      pages: accessibilityPages,
      statementHandledByPlugin: true,
    });
    const accessibilityWarnings = accessibilityReportToWarnings(accessibilityReport);
    allWarnings.push(...accessibilityWarnings);
    yield {
      type: "step",
      step: "accessibility-qa",
      status: accessibilityReport.summary.fail > 0 ? "fail" : "ok",
      label: "Running accessibility QA",
      message:
        accessibilityReport.summary.fail > 0
          ? `${accessibilityReport.summary.fail} launch-blocking accessibility issue(s) found.`
          : "Accessibility QA completed.",
      accessibilityReport,
    };
  }

  // 2. Site identity
  yield* step("site-identity", "Setting site name", async () => {
    await wp.setSiteName(req.wpUsername, req.wpAppPassword, req.siteName);
  });

  // 3. Site logo
  if (req.brandKit.logo) {
    const logo = req.brandKit.logo;
    yield* step("logo", "Setting site logo", async () => {
      await wp.setLogo(logo.filename, logo.dataBase64);
    });
  }

  // 4. Site favicon
  if (req.brandKit.favicon) {
    const favicon = req.brandKit.favicon;
    yield* step("favicon", "Setting site favicon", async () => {
      await wp.setFavicon(favicon.filename, favicon.dataBase64);
    });
  }

  // 5. Flush Elementor CSS
  yield* step("flush-css", "Flushing Elementor CSS cache", async () => {
    await wp.flushCss();
  });

  yield {
    type: "done",
    status: "ok",
    label: "Deploy complete",
    buildNotes: dedupe(allBuildNotes),
    warnings: dedupe(allWarnings),
    accessibilityReport,
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
  const title = pageContent.wpTitle ?? titleFromPage(pageContent.page);
  const built = buildAtomicPage({
    page: pageContent.page,
    title,
    practiceName: req.content.practiceName,
    preset: toAtomicPreset(req.theme),
    site: req.content.site,
    pageData: pageContent.pageData,
    slots: pageContent.slots,
  });
  return {
    page: pageContent.page,
    title,
    slug: pageContent.slug ?? pageContent.serviceSlug ?? pageContent.page,
    wpPageTemplate: pageContent.wpPageTemplate ?? DEFAULT_WP_PAGE_TEMPLATE,
    elementorVersion: req.elementorVersion ?? built.elementorVersion,
    elementorData: built.elementorData,
    buildNotes: [
      ...(pageContent.buildNotes ?? []),
      ...built.legacyExceptions.map(
        (field) =>
          `[ATOMIC EXCEPTION] ${field} uses an isolated legacy embed widget.`,
      ),
    ],
    warnings: built.warnings,
  };
}

function toAtomicPreset(theme: string): AtomicVisualPreset {
  if (theme === "summit" || theme === "lux") return theme;
  return "elevate";
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
