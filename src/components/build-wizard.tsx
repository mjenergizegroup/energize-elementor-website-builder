"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Globe2,
  ListChecks,
  Palette,
  Rocket,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { PagePlanWorkspace } from "@/components/page-plan-workspace";
import { ContentMatchWorkspace } from "@/components/content-match-workspace";
import { GOOGLE_FONTS } from "@/lib/google-fonts";
import { cn } from "@/lib/utils";
import type { BrandKit, UploadedAsset } from "@/lib/types";
import type { PageContent } from "@/lib/injection/types";
import type { ElevatePageType } from "@/lib/builders/elevate/types";
import type { TemplateCompileBundle } from "@/lib/template-import/types";
import type {
  MigrationResolution,
  MigrationSourcePage,
  MigrationWizardWorkspace,
} from "@/lib/migration/types";
import {
  BUILD_WIZARD_STEPS,
  type BuildWizardStep,
} from "@/lib/build-wizard/flow";
import type { LayoutLibraryItem } from "@/lib/layouts/types";
import type { PersistedContentMatch } from "@/lib/content-matches/types";
import type { PreparedDraftSummary } from "@/lib/prepared-drafts/types";
import type { PreparedBuildPlanSummary } from "@/lib/website-builds/types";
import {
  pagePath,
  validatePagePlan,
  type PagePlanItem,
  type PagePlanItemInput,
} from "@/lib/page-plan/types";

export interface InitialClient {
  id: string;
  name: string;
  slug: string;
  wpSiteUrl: string;
  wpUsername: string;
  brandKit: BrandKit;
}

export interface InitialMigrationProject {
  id: string;
  crawlJobId?: string;
  name: string;
  sourceUrl?: string;
  status: string;
  stage: string;
  sourcePages: MigrationSourcePage[];
  compileBundle?: TemplateCompileBundle;
  resolutions: MigrationResolution[];
  workspace?: MigrationWizardWorkspace;
  pagePlan: PagePlanItem[];
  contentMatches: PersistedContentMatch[];
  preparedDrafts: PreparedDraftSummary[];
}

type Asset = UploadedAsset & { previewUrl: string };
type StructuredFieldValue =
  | string
  | string[]
  | Record<string, string>
  | Array<Record<string, string>>;
type StructuredPageData = Record<string, Record<string, StructuredFieldValue>>;

interface StructuredParseResult {
  site: Record<string, string>;
  pages: Record<string, StructuredPageData>;
  service_pages: Record<string, StructuredPageData>;
  warnings: string[];
}

// A page detected by the parser, with selection + editable title/slug.
interface DetectedPage extends PageContent {
  selected: boolean;
  builderPageType?: ElevatePageType;
  serviceSlug?: string;
  pageData?: StructuredPageData;
}

interface StepEvent {
  key: string;
  label: string;
  status: "start" | "ok" | "fail";
  message?: string;
}

interface DeployedLink {
  wpPageId: number;
  title: string;
  editUrl: string;
  viewUrl: string;
  kind?: "content" | "accessibility-statement";
}

interface AccessibilityIssue {
  id: string;
  severity: "pass" | "warning" | "fail" | "manual";
  rule: string;
  page?: string;
  message: string;
  guidance?: string;
}

interface AccessibilityReport {
  target: "WCAG 2.2 AA";
  summary: {
    pass: number;
    warning: number;
    fail: number;
    manual: number;
  };
  launchReady: boolean;
  issues: AccessibilityIssue[];
  checkedAt: string;
}

interface CrawlPageEntry {
  url: string;
  title: string;
  markdown: string;
  metadata: Record<string, unknown>;
  recommended: boolean;
  skipReason?: string;
}

const STEPS = BUILD_WIZARD_STEPS;

const STEP_DETAILS: {
  title: BuildWizardStep;
  rail: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Project",
    rail: "Website setup",
    description: "Name the website project and identify whether content will come from an existing site.",
    icon: Globe2,
  },
  {
    title: "Plan Pages",
    rail: "Pages and layouts",
    description: "Name the destination pages and choose a reusable layout for each one.",
    icon: FileText,
  },
  {
    title: "Import Content",
    rail: "Automatic matching",
    description: "Import the current website and confirm only the page matches that need help.",
    icon: Globe2,
  },
  {
    title: "Brand & Destination",
    rail: "Identity and WordPress",
    description: "Add practice details, brand assets, and the WordPress destination.",
    icon: Palette,
  },
  {
    title: "Review & Build",
    rail: "Final check",
    description: "Confirm the planned drafts before the automatic dry run.",
    icon: ListChecks,
  },
];

const DEFAULT_COLORS = {
  primary: "#1e6091",
  secondary: "#168aad",
  accent: "#d9a566",
  text: "#1b2a33",
  background: "#ffffff",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWebUrl(value: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`;
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(file);
  });
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "ico") return "image/x-icon";
  return "image/png";
}

function previewUrlFromAsset(asset?: UploadedAsset): string | undefined {
  if (!asset?.dataBase64) return undefined;
  return `data:${mimeFromFilename(asset.filename)};base64,${asset.dataBase64}`;
}

export function BuildWizard({
  initialClient,
  initialMigrationProject,
  initialLayouts = [],
  buildType = "new-website",
}: {
  initialClient?: InitialClient;
  initialMigrationProject?: InitialMigrationProject;
  initialLayouts?: LayoutLibraryItem[];
  buildType?: string;
}) {
  const router = useRouter();
  const initialWorkspace = initialMigrationProject?.workspace;
  const resumedSourcePages = initialMigrationProject?.sourcePages ?? [];
  const [step, setStep] = useState(() => {
    if (!initialMigrationProject) return 0;
    if (initialMigrationProject.pagePlan.length === 0) return 0;
    if (resumedSourcePages.length === 0) return 1;
    return Math.min(initialWorkspace?.step ?? 2, 4);
  });

  const [siteKind, setSiteKind] = useState<"existing" | "new">(
    initialWorkspace?.siteKind ?? "existing",
  );
  const [crawlUrl, setCrawlUrl] = useState(
    initialMigrationProject?.sourceUrl ?? initialClient?.wpSiteUrl ?? "",
  );
  const [crawlJobId, setCrawlJobId] = useState(
    initialMigrationProject?.crawlJobId ?? "",
  );
  const [crawlStatus, setCrawlStatus] = useState<
    "idle" | "scraping" | "completed" | "failed"
  >(resumedSourcePages.length > 0 ? "completed" : "idle");
  const [crawlProgress, setCrawlProgress] = useState({ completed: 0, total: 0 });
  const [crawlError, setCrawlError] = useState("");
  const [savingCrawl, setSavingCrawl] = useState(false);
  const crawlIngestStartedRef = useRef(false);
  const [sourceSaved, setSourceSaved] = useState(resumedSourcePages.length > 0);
  const [migrationSourcePages, setMigrationSourcePages] =
    useState<MigrationSourcePage[]>(resumedSourcePages);

  const [name, setName] = useState(
    initialClient?.name ?? initialWorkspace?.name ?? initialMigrationProject?.name.replace(/\s+migration$/i, "") ?? "",
  );
  const [slug, setSlug] = useState(
    initialClient?.slug ?? initialWorkspace?.slug ?? slugify(initialMigrationProject?.name.replace(/\s+migration$/i, "") ?? ""),
  );
  const [address, setAddress] = useState(initialWorkspace?.address ?? "");
  const [phone, setPhone] = useState(initialWorkspace?.phone ?? "");
  const [email, setEmail] = useState(initialWorkspace?.email ?? "");
  const [hours, setHours] = useState(initialWorkspace?.hours ?? "");
  const [bookingLink, setBookingLink] = useState(initialWorkspace?.bookingLink ?? "");
  const [social, setSocial] = useState(initialWorkspace?.social ?? "");

  const [colors, setColors] = useState(
    initialClient?.brandKit.colors ?? initialWorkspace?.colors ?? DEFAULT_COLORS,
  );
  const [fontHeading, setFontHeading] = useState(
    initialClient?.brandKit.fonts.heading ?? initialWorkspace?.fonts.heading ?? "Poppins",
  );
  const [fontBody, setFontBody] = useState(
    initialClient?.brandKit.fonts.body ?? initialWorkspace?.fonts.body ?? "Inter",
  );
  const [logo, setLogo] = useState<Asset | null>(() => {
    const asset = initialClient?.brandKit.logo ?? initialWorkspace?.logo;
    const previewUrl = previewUrlFromAsset(asset);
    return asset && previewUrl ? { ...asset, previewUrl } : null;
  });
  const [favicon, setFavicon] = useState<Asset | null>(() => {
    const asset = initialClient?.brandKit.favicon ?? initialWorkspace?.favicon;
    const previewUrl = previewUrlFromAsset(asset);
    return asset && previewUrl ? { ...asset, previewUrl } : null;
  });

  const [siteUrl, setSiteUrl] = useState(
    initialClient?.wpSiteUrl ?? initialWorkspace?.siteUrl ?? "",
  );
  const [username, setUsername] = useState(
    initialClient?.wpUsername || initialWorkspace?.username || "websites@energize-group.com",
  );
  const [appPassword, setAppPassword] = useState("");

  const [deployMode] = useState<"pages" | "branding-only">(
    initialWorkspace?.deployMode ?? "pages",
  );
  const [structuredResult] = useState<StructuredParseResult | null>(null);
  const [practiceMeta] = useState<{
    practiceName: string;
    city?: string;
    doctorName?: string;
  } | null>(null);
  const detectedPages: DetectedPage[] = [];
  const [templateCompileBundle] =
    useState<TemplateCompileBundle | null>(
      initialMigrationProject?.compileBundle ?? null,
    );
  const [dependencyResolutions] =
    useState<MigrationResolution[]>(initialMigrationProject?.resolutions ?? []);
  const [migrationProjectId, setMigrationProjectId] = useState(
    initialMigrationProject?.id ?? "",
  );
  const [contentMatches, setContentMatches] = useState<PersistedContentMatch[]>(
    initialMigrationProject?.contentMatches ?? [],
  );
  const [savingContentMatchId, setSavingContentMatchId] = useState<string>();
  const [preparedDrafts, setPreparedDrafts] = useState<PreparedDraftSummary[]>(
    initialMigrationProject?.preparedDrafts ?? [],
  );
  const [preparingDrafts, setPreparingDrafts] = useState(false);
  const [buildPlan, setBuildPlan] = useState<PreparedBuildPlanSummary | null>(null);
  const [checkingBuild, setCheckingBuild] = useState(false);
  const [buildCheckError, setBuildCheckError] = useState("");
  const automaticBuildCheckRef = useRef("");
  const [pagePlanItems, setPagePlanItems] = useState<PagePlanItemInput[]>(() =>
    (initialMigrationProject?.pagePlan ?? []).map((item) => ({
      id: item.id,
      position: item.position,
      pageName: item.pageName,
      slug: item.slug,
      titleTag: item.titleTag,
      pageType: item.pageType,
      layoutRevisionId: item.layoutRevisionId,
      emptyDraftAllowed: item.emptyDraftAllowed,
      status: item.status,
    })),
  );
  const [pagePlanSaveState, setPagePlanSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >(initialMigrationProject?.pagePlan.length ? "saved" : "idle");
  const pagePlanSaveRequestRef = useRef(0);
  const buildTypeLabel =
    buildType === "landing-page"
      ? "Landing Page"
      : buildType === "migrate"
        ? "Migrate"
        : "New Website";

  const [deploying, setDeploying] = useState(false);
  const [events, setEvents] = useState<StepEvent[]>([]);
  const [deployedLinks, setDeployedLinks] = useState<DeployedLink[]>([]);
  const [buildNotes, setBuildNotes] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [accessibilityReport, setAccessibilityReport] =
    useState<AccessibilityReport | null>(null);
  const [finished, setFinished] = useState<null | "success" | "partial" | "failed">(
    null,
  );

  useEffect(() => {
    if (!crawlJobId || crawlStatus !== "scraping") return;
    void pollCrawl(crawlJobId);
    const timer = window.setInterval(() => {
      void pollCrawl(crawlJobId);
    }, 3000);
    return () => window.clearInterval(timer);
    // pollCrawl reads the latest render state and the status change stops this interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlJobId, crawlStatus]);

  useEffect(() => {
    if (
      step !== 4 ||
      buildType !== "migrate" ||
      deployMode !== "pages" ||
      !migrationProjectId
    ) {
      return;
    }
    const key = JSON.stringify({
      migrationProjectId,
      drafts: preparedDrafts.map((draft) => [draft.id, draft.contentChecksum]),
      name,
      slug,
      siteUrl,
      username,
      colors,
      fonts: [fontHeading, fontBody],
      logo: logo ? [logo.filename, logo.dataBase64] : null,
      favicon: favicon ? [favicon.filename, favicon.dataBase64] : null,
    });
    if (automaticBuildCheckRef.current === key) return;
    automaticBuildCheckRef.current = key;
    void runWebsiteDryRun();
    // The final check is intentionally triggered when the user enters Review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, migrationProjectId]);

  useEffect(() => {
    if (!migrationProjectId) return;
    const workspace = currentMigrationWorkspace();
    const timer = window.setTimeout(() => {
      void fetch(`/api/migrations/${migrationProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(templateCompileBundle
            ? {
                bundle: templateCompileBundle,
                resolutions: dependencyResolutions,
              }
            : {}),
          workspace,
        }),
      })
        .then(async (response) => {
          if (response.ok) return;
          const json = await response.json().catch(() => ({}));
          throw new Error(json.error ?? "Could not save the migration workspace.");
        })
        .catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not save the migration workspace.",
          );
        });
    }, 600);
    return () => window.clearTimeout(timer);
    // All values read by currentMigrationWorkspace are listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    address,
    bookingLink,
    colors,
    dependencyResolutions,
    deployMode,
    email,
    favicon,
    fontBody,
    fontHeading,
    hours,
    logo,
    migrationProjectId,
    name,
    phone,
    siteKind,
    siteUrl,
    slug,
    social,
    step,
    templateCompileBundle,
    username,
  ]);

  function currentMigrationWorkspace(): MigrationWizardWorkspace {
    return {
      schemaVersion: 1,
      step,
      siteKind,
      deployMode,
      name,
      slug,
      address,
      phone,
      email,
      hours,
      bookingLink,
      social,
      siteUrl,
      username,
      colors,
      fonts: { heading: fontHeading, body: fontBody },
      ...(logo
        ? { logo: { filename: logo.filename, dataBase64: logo.dataBase64 } }
        : {}),
      ...(favicon
        ? { favicon: { filename: favicon.filename, dataBase64: favicon.dataBase64 } }
        : {}),
    };
  }

  useEffect(() => {
    if (!migrationProjectId) return;
    const validation = validatePagePlan(pagePlanItems, initialLayouts);
    if (pagePlanItems.length > 0 && !validation.valid) {
      pagePlanSaveRequestRef.current += 1;
      setPagePlanSaveState("idle");
      return;
    }
    setPagePlanSaveState("saving");
    const requestId = ++pagePlanSaveRequestRef.current;
    const timer = window.setTimeout(() => {
      void fetch(`/api/migrations/${migrationProjectId}/page-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pagePlanItems }),
      })
        .then(async (response) => {
          const json = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(json.error ?? "Could not save the Page Plan.");
          }
          if (pagePlanSaveRequestRef.current === requestId) {
            setPagePlanSaveState("saved");
          }
        })
        .catch((error) => {
          if (pagePlanSaveRequestRef.current !== requestId) return;
          setPagePlanSaveState("error");
          toast.error(error instanceof Error ? error.message : "Could not save the Page Plan.");
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [initialLayouts, migrationProjectId, pagePlanItems]);

  async function startCrawl() {
    const normalizedUrl = normalizeWebUrl(crawlUrl);
    if (!normalizedUrl) {
      toast.error("Enter a valid site URL.");
      return;
    }

    setCrawlUrl(normalizedUrl);
    setCrawlStatus("scraping");
    setCrawlJobId("");
    setCrawlProgress({ completed: 0, total: 0 });
    setCrawlError("");
    setSourceSaved(false);
    setMigrationSourcePages([]);
    setContentMatches([]);
    crawlIngestStartedRef.current = false;

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: normalizedUrl,
          ...(migrationProjectId ? { projectId: migrationProjectId } : {}),
          ...(initialClient?.id ? { clientId: initialClient.id } : {}),
          ...(name.trim() ? { projectName: `${name.trim()} migration` } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not start crawl.");
        setCrawlStatus("idle");
        return;
      }
      setCrawlJobId(json.jobId);
      setMigrationProjectId(json.projectId);
      toast.success("Crawl started.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start crawl.");
      setCrawlStatus("idle");
    }
  }

  async function pollCrawl(jobId: string) {
    try {
      const res = await fetch(`/api/crawl/${jobId}`);
      const json = await res.json();
      if (!res.ok) {
        const message =
          res.status === 429
            ? "Rate limited, try again in a minute"
            : json.error ?? "Could not check crawl status.";
        toast.error(message);
        setCrawlError(message);
        if (res.status !== 429) setCrawlStatus("failed");
        return;
      }

      setCrawlStatus(json.status);
      if (json.projectId) setMigrationProjectId(json.projectId);
      setCrawlProgress(json.progress ?? { completed: 0, total: 0 });
      setCrawlError(json.error ?? "");
      if (json.keep) {
        const importUrls = json.keep.map((page: CrawlPageEntry) => page.url);
        if (json.status === "completed" && importUrls.length === 0) {
          setCrawlError("No useful website pages were found. Check the URL and try again.");
          setCrawlStatus("failed");
        }
        if (
          json.status === "completed" &&
          importUrls.length > 0 &&
          !sourceSaved &&
          !crawlIngestStartedRef.current
        ) {
          crawlIngestStartedRef.current = true;
          void saveSelectedCrawlPages(jobId, importUrls);
        }
      }
      if (json.status === "failed") {
        toast.error(json.error ?? "Crawl failed.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not check crawl status.";
      toast.error(message);
      setCrawlError(message);
      setCrawlStatus("failed");
    }
  }

  async function saveSelectedCrawlPages(
    crawlJobIdOverride: string,
    selectedUrlsOverride: string[],
  ): Promise<boolean> {
    if (!migrationProjectId || !crawlJobIdOverride) {
      toast.error("Start the crawl again so this migration can be saved.");
      return false;
    }
    if (selectedUrlsOverride.length === 0) {
      toast.error("No useful website pages were found.");
      return false;
    }
    setSavingCrawl(true);
    try {
      const response = await fetch(
        `/api/migrations/${migrationProjectId}/source`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crawlJobId: crawlJobIdOverride,
            selectedUrls: selectedUrlsOverride,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Could not save the selected source pages.");
      }
      setSourceSaved(true);
      setMigrationSourcePages(
        Array.isArray(json.project?.sourcePages) ? json.project.sourcePages : [],
      );
      setContentMatches(Array.isArray(json.matches) ? json.matches : []);
      toast.success("Website content imported and matched to the Page Plan.");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the selected source pages.",
      );
      return false;
    } finally {
      setSavingCrawl(false);
    }
  }

  async function ensureMigrationProject(): Promise<string | null> {
    if (migrationProjectId) return migrationProjectId;
    try {
      const normalizedSourceUrl = normalizeWebUrl(crawlUrl);
      const response = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${name.trim()} website`,
          ...(siteKind === "existing" && normalizedSourceUrl
            ? { sourceUrl: normalizedSourceUrl }
            : {}),
          ...(initialClient?.id ? { clientId: initialClient.id } : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not create the website project.");
      const projectId = json.project.id as string;
      setMigrationProjectId(projectId);
      return projectId;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the website project.");
      return null;
    }
  }

  async function rebuildMatches(projectId = migrationProjectId): Promise<boolean> {
    if (!projectId) return false;
    try {
      const response = await fetch(`/api/migrations/${projectId}/content-matches`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not match website content.");
      setContentMatches(Array.isArray(json.matches) ? json.matches : []);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not match website content.");
      return false;
    }
  }

  async function confirmMatch(pagePlanItemId: string, sourcePageId?: string) {
    if (!migrationProjectId) return;
    setSavingContentMatchId(pagePlanItemId);
    try {
      const response = await fetch(`/api/migrations/${migrationProjectId}/content-matches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagePlanItemId, ...(sourcePageId ? { sourcePageId } : {}) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save the content match.");
      setContentMatches(Array.isArray(json.matches) ? json.matches : []);
      toast.success("Content match saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the content match.");
    } finally {
      setSavingContentMatchId(undefined);
    }
  }

  async function saveWorkspaceNow(): Promise<boolean> {
    if (!migrationProjectId) return false;
    try {
      const response = await fetch(`/api/migrations/${migrationProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(templateCompileBundle
            ? { bundle: templateCompileBundle, resolutions: dependencyResolutions }
            : {}),
          workspace: currentMigrationWorkspace(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not save the website setup.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the website setup.");
      return false;
    }
  }

  async function prepareDrafts(): Promise<boolean> {
    if (!migrationProjectId) return false;
    setPreparingDrafts(true);
    try {
      if (!(await saveWorkspaceNow())) return false;
      const response = await fetch(`/api/migrations/${migrationProjectId}/prepared-drafts`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not prepare the website drafts.");
      const drafts = Array.isArray(json.drafts) ? json.drafts : [];
      setPreparedDrafts(drafts);
      const attention = drafts.filter(
        (draft: PreparedDraftSummary) => draft.status === "needs_attention",
      ).length;
      if (attention > 0) toast.warning(`${attention} draft${attention === 1 ? " needs" : "s need"} attention.`);
      else toast.success(`${drafts.length} drafts prepared safely.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the website drafts.");
      return false;
    } finally {
      setPreparingDrafts(false);
    }
  }

  async function handleLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2MB or smaller.");
      return;
    }
    if (!/\.(png|jpe?g|svg)$/i.test(file.name)) {
      toast.error("Logo must be PNG, JPG, or SVG.");
      return;
    }
    const dataBase64 = await fileToBase64(file);
    setLogo({
      filename: file.name,
      dataBase64,
      previewUrl: URL.createObjectURL(file),
    });
    toast.success(`${file.name} loaded for logo.`);
  }

  async function handleFavicon(file: File) {
    if (file.size > 500 * 1024) {
      toast.error("Favicon must be 500KB or smaller.");
      return;
    }
    if (!/\.(png|ico)$/i.test(file.name)) {
      toast.error("Favicon must be PNG or ICO.");
      return;
    }
    const dataBase64 = await fileToBase64(file);
    setFavicon({
      filename: file.name,
      dataBase64,
      previewUrl: URL.createObjectURL(file),
    });
    toast.success(`${file.name} loaded for favicon.`);
  }

  function validateStep(current: number): string | null {
    switch (current) {
      case 0:
        if (!name.trim()) return "Practice name is required.";
        if (!slug.trim()) return "Slug is required.";
        if (siteKind === "existing" && !normalizeWebUrl(crawlUrl)) return "Enter a valid current website URL.";
        return null;
      case 1:
        if (deployMode === "branding-only") return null;
        if (migrationProjectId && pagePlanSaveState === "error") {
          return "The Page Plan must be saved before review.";
        }
        if (migrationProjectId && pagePlanSaveState === "saving") {
          return "Wait for the Page Plan to finish saving.";
        }
        return validatePagePlan(pagePlanItems, initialLayouts).firstError ?? null;
      case 2:
        if (siteKind === "existing") {
          if (crawlStatus === "scraping" || savingCrawl) return "Wait for the website import to finish.";
          if (!sourceSaved) return "Import the current website before continuing.";
        }
        if (contentMatches.some((match) => match.status === "check")) {
          return "Choose the source content for every page marked Check match.";
        }
        if (contentMatches.length !== pagePlanItems.length) {
          return "Finish matching content to the Page Plan.";
        }
        return null;
      case 3:
        if (!logo?.dataBase64) return "Site logo is required.";
        if (!favicon?.dataBase64) return "Site favicon is required.";
        if (!siteUrl.trim()) return "WordPress site URL is required.";
        if (!username.trim()) return "WordPress username is required.";
        if (!initialClient && !appPassword.trim())
          return "Application password is required for a new client.";
        return null;
      default:
        return null;
    }
  }

  async function next() {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    if (step === 0) {
      const projectId = await ensureMigrationProject();
      if (!projectId) return;
    }
    if (step === 1 && (siteKind === "new" || sourceSaved)) {
      const matched = await rebuildMatches();
      if (!matched) return;
    }
    if (step === 3) {
      const prepared = await prepareDrafts();
      if (!prepared) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function buildBrandKit(): BrandKit {
    const kit: BrandKit = {
      colors,
      fonts: { heading: fontHeading, body: fontBody },
    };
    if (logo?.dataBase64)
      kit.logo = { filename: logo.filename, dataBase64: logo.dataBase64 };
    if (favicon?.dataBase64)
      kit.favicon = { filename: favicon.filename, dataBase64: favicon.dataBase64 };
    return kit;
  }

  function upsertEvent(label: string, status: StepEvent["status"], message?: string) {
    setEvents((prev) => {
      const idx = [...prev].reverse().findIndex((e) => e.label === label);
      if (status === "start" || idx === -1) {
        return [...prev, { key: `${label}-${prev.length}`, label, status, message }];
      }
      const realIdx = prev.length - 1 - idx;
      const copy = [...prev];
      copy[realIdx] = { ...copy[realIdx], status, message };
      return copy;
    });
  }

  function buildWebsiteDestination(includePassword = false) {
    return {
      ...(initialClient?.id ? { clientId: initialClient.id } : {}),
      name,
      slug,
      wpSiteUrl: siteUrl,
      wpUsername: username,
      ...(includePassword && appPassword ? { wpAppPassword: appPassword } : {}),
      brandKit: buildBrandKit(),
    };
  }

  async function runWebsiteDryRun() {
    if (!migrationProjectId) return;
    setCheckingBuild(true);
    setBuildCheckError("");
    try {
      const response = await fetch(`/api/migrations/${migrationProjectId}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dry-run",
          destination: buildWebsiteDestination(),
        }),
      });
      const json = await response.json().catch(() => ({}));
      const plan = json.plan as PreparedBuildPlanSummary | undefined;
      if (plan) setBuildPlan(plan);
      if (!response.ok || !plan || plan.status !== "ready") {
        throw new Error(json.error ?? plan?.blockers[0] ?? "The automatic final check needs attention.");
      }
    } catch (error) {
      setBuildPlan(null);
      setBuildCheckError(error instanceof Error ? error.message : "The automatic final check could not finish.");
    } finally {
      setCheckingBuild(false);
    }
  }

  async function deployMigration(retryFailedOnly = false) {
    if (!migrationProjectId) throw new Error("The website project is not ready.");
    if (!retryFailedOnly && buildPlan?.status !== "ready") {
      throw new Error("Wait for the automatic final check before creating drafts.");
    }
    setEvents([
      {
        key: "preparing-destination",
        label: "Preparing destination",
        status: "start",
      },
    ]);
    const response = await fetch(`/api/migrations/${migrationProjectId}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: retryFailedOnly ? "retry" : "execute",
        destination: buildWebsiteDestination(true),
      }),
    });
    const json = await response.json().catch(() => ({}));
    const plan = json.plan as PreparedBuildPlanSummary | undefined;
    if (!response.ok && !plan) throw new Error(json.error ?? "WordPress draft creation failed.");
    if (!plan) throw new Error("WordPress draft creation returned no result.");
    setBuildPlan(plan);
    setEvents(
      plan.events.map((event, index) => ({
        key: `${event.at}-${index}`,
        label: event.label,
        status: event.status,
        message: event.message,
      })),
    );
    setWarnings(plan.warnings);
    setDeployedLinks(
      plan.items.flatMap((item) =>
        item.status === "draft" && item.wpPageId && item.editUrl && item.viewUrl
          ? [{
              wpPageId: item.wpPageId,
              title: item.title,
              editUrl: item.editUrl,
              viewUrl: item.viewUrl,
              kind: "content" as const,
            }]
          : [],
      ),
    );
    setFinished(
      plan.status === "complete"
        ? "success"
        : plan.status === "partial"
          ? "partial"
          : "failed",
    );
  }

  async function deploy(retryFailedOnly = false) {
    const error = [1, 2, 3, 4].map(validateStep).find(Boolean);
    if (error) {
      toast.error(error);
      return;
    }
    setDeploying(true);
    setEvents([]);
    setDeployedLinks([]);
    setBuildNotes([]);
    setWarnings([]);
    setAccessibilityReport(null);
    setFinished(null);
    if (logo && !logo.dataBase64) {
      toast.error("Logo file data is missing. Upload the logo again.");
      setDeploying(false);
      return;
    }
    if (favicon && !favicon.dataBase64) {
      toast.error("Favicon file data is missing. Upload the favicon again.");
      setDeploying(false);
      return;
    }

    if (buildType === "migrate" && deployMode === "pages") {
      try {
        await deployMigration(retryFailedOnly);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Migration deployment failed.";
        toast.error(message);
        upsertEvent("Migration stopped", "fail", message);
        setFinished("failed");
      } finally {
        setDeploying(false);
      }
      return;
    }

    const pages = deployMode === "branding-only"
      ? []
      : detectedPages.filter((p) => p.selected).map((p) => ({
        page: p.page,
        wpTitle: p.wpTitle,
        slug: p.slug,
        wpPageTemplate: p.wpPageTemplate,
        slots: p.slots,
        buildNotes: p.buildNotes,
        builderPageType: p.builderPageType,
        serviceSlug: p.serviceSlug,
        pageData: p.pageData,
      }));
    if (deployMode === "pages" && structuredResult) {
      const unsupported = pages.find((p) => !p.builderPageType || !p.pageData);
      if (unsupported) {
        toast.error(`No Elevate builder is mapped for ${unsupported.page}.`);
        setDeploying(false);
        return;
      }
    }
    // The wizard's booking link and phone override the content doc: every
    // booking button uses booking_url, click-to-call buttons use phone_tel.
    const site = {
      ...structuredResult?.site,
      ...(bookingLink.trim() ? { booking_url: bookingLink.trim() } : {}),
      ...(phone.trim()
        ? { phone: phone.trim(), phone_tel: `tel:${phone.replace(/[^\d+]/g, "")}` }
        : {}),
    };
    const content = {
      practiceName: practiceMeta?.practiceName ?? name,
      city: practiceMeta?.city,
      doctorName: practiceMeta?.doctorName,
      site,
      pages,
    };

    try {
      // Stream the deploy.
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deployMode,
          clientId: initialClient?.id,
          client: {
            name,
            slug,
            wpSiteUrl: siteUrl,
            wpUsername: username,
            wpAppPassword: appPassword || undefined,
          },
          brandKit: buildBrandKit(),
          content,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? `Deploy failed (status ${res.status}).`);
        setFinished("failed");
        setDeploying(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawFatal = false;
      let sawFail = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "fatal") {
            sawFatal = true;
            upsertEvent(event.label, "fail", event.message);
          } else if (event.type === "done") {
            setBuildNotes(event.buildNotes ?? []);
            setWarnings(event.warnings ?? []);
            if (event.accessibilityReport) {
              setAccessibilityReport(event.accessibilityReport);
            }
          } else {
            if (event.status === "fail") sawFail = true;
            if (event.accessibilityReport) {
              setAccessibilityReport(event.accessibilityReport);
            }
            upsertEvent(event.label, event.status, event.message);
            if (event.status === "ok" && event.data?.wpPageId) {
              setDeployedLinks((prev) => [
                ...prev,
                {
                  wpPageId: event.data.wpPageId,
                  title: event.data.title ?? event.data.page,
                  editUrl: event.data.editUrl,
                  viewUrl: event.data.viewUrl,
                  kind: "content",
                },
              ]);
            }
          }
        }
      }

      setFinished(sawFatal ? "failed" : sawFail ? "partial" : "success");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deploy failed.");
      setFinished("failed");
    } finally {
      setDeploying(false);
    }
  }

  // Deploy and result view.
  if (deploying || finished) {
    const title =
      buildType === "migrate"
        ? finished === "success"
          ? "Drafts ready"
          : finished === "partial"
            ? "Some drafts need another try"
            : finished === "failed"
              ? "Draft creation stopped"
              : "Creating drafts"
        : finished === "success"
          ? "Deploy complete"
          : finished === "partial"
            ? "Deploy finished with issues"
            : finished === "failed"
              ? "Deploy failed"
              : "Deploying";

    return (
      <div className="page-body">
        <PageHead
          title={title}
          subline={
            buildType === "migrate"
              ? "Prepared pages are saved as recoverable WordPress drafts and are never published automatically."
              : "The deploy stream validates the Atomic Foundation before creating WordPress drafts."
          }
          clientName={name || practiceMeta?.practiceName || "Untitled client"}
          buildTypeLabel={buildTypeLabel}
        />

        <section className="wizard-frame">
          <PanelHead
            icon={Rocket}
            title={buildType === "migrate" ? "Website draft progress" : "Deployment progress"}
            description={
              buildType === "migrate"
                ? "Preparing the destination, applying the brand, creating page drafts, and completing final checks."
                : deployMode === "branding-only"
                ? "Atomic variables, components, site identity, assets, and cache status."
                : "Atomic Foundation, page drafts, assets, and cache status."
            }
          />
          <div className="space-y-6 bg-[var(--color-surface-raised)] p-6 sm:p-8">
            <ul
              className="space-y-2 text-sm"
              aria-live="polite"
              aria-busy={deploying}
              aria-label="Deployment progress"
            >
              {events.map((e) => (
                <li
                  key={e.key}
                  className="flex items-start gap-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border text-xs font-bold ${
                      e.status === "ok"
                        ? "border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-on-primary)]"
                        : e.status === "fail"
                          ? "border-[var(--color-danger)] bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
                          : "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)]"
                    }`}
                  >
                    {e.status === "ok" ? <Check className="size-3.5" /> : e.status === "fail" ? "x" : "..."}
                  </span>
                  <span
                    className={`leading-6 ${
                      e.status === "fail" ? "text-destructive" : "text-[var(--ink)]"
                    }`}
                  >
                    {e.label}
                    {e.message ? ` - ${e.message}` : ""}
                  </span>
                </li>
              ))}
              {events.length === 0 && (
                <li className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text-secondary)]">
                  Starting...
                </li>
              )}
            </ul>

            {deployedLinks.length > 0 && (
              <div className="space-y-3">
                <SectionLabel>Draft pages</SectionLabel>
              <ul className="space-y-1 text-sm">
                {deployedLinks.map((l) => (
                  <li key={l.wpPageId} className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{l.title}</span>
                    {l.kind === "accessibility-statement" && (
                      <Badge variant="outline">Accessibility</Badge>
                    )}
                    <a
                      href={l.editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[var(--color-border-default)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary-hover)]"
                    >
                      Edit in WordPress
                    </a>
                    <a
                      href={l.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[var(--color-border-default)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary-hover)]"
                    >
                      Preview
                    </a>
                  </li>
                ))}
              </ul>
              </div>
            )}

            {buildType === "migrate" && buildPlan?.items.some((item) => item.status === "failed") && (
              <div className="space-y-3">
                <SectionLabel>Drafts that need another try</SectionLabel>
                <div className="overflow-hidden rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-tint)]">
                  {buildPlan.items
                    .filter((item) => item.status === "failed")
                    .map((item) => (
                      <div key={item.preparedDraftId} className="border-b border-[var(--color-primary)] p-4 last:border-b-0">
                        <p className="font-bold text-[var(--color-text-primary)]">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {item.error ?? "WordPress could not create this draft."}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {accessibilityReport && (
              <div className="space-y-3">
                <SectionLabel>Accessibility QA</SectionLabel>
                <div className="space-y-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={accessibilityReport.launchReady ? "default" : "destructive"}>
                      {accessibilityReport.launchReady ? "No blocking issues" : "Launch blocked"}
                    </Badge>
                    <Badge variant="secondary">
                      {accessibilityReport.summary.pass} pass
                    </Badge>
                    <Badge variant="secondary">
                      {accessibilityReport.summary.warning} warnings
                    </Badge>
                    <Badge variant="destructive">
                      {accessibilityReport.summary.fail} fail
                    </Badge>
                    <Badge variant="outline">
                      {accessibilityReport.summary.manual} manual
                    </Badge>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-auto">
                    {accessibilityReport.issues
                      .filter((issue) => issue.severity !== "pass")
                      .map((issue) => (
                        <div
                          key={issue.id}
                          className="border border-[var(--line)] bg-[var(--paper-2)] p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                issue.severity === "fail"
                                  ? "destructive"
                                  : issue.severity === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {issue.severity}
                            </Badge>
                            <span className="font-semibold text-[var(--ink)]">
                              {issue.rule}
                            </span>
                            {issue.page && (
                              <span className="text-xs text-[var(--muted)]">
                                {issue.page}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-[var(--ink)]">{issue.message}</p>
                          {issue.guidance && (
                            <p className="mt-1 text-[var(--muted)]">
                              {issue.guidance}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {(buildNotes.length > 0 || warnings.length > 0) && (
              <div className="space-y-3">
                <SectionLabel>Build notes for David&apos;s team</SectionLabel>
                <div className="space-y-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 text-sm leading-6">
              {buildNotes.map((n, i) => (
                <p key={`note-${i}`}>{n}</p>
              ))}
              {warnings.map((w, i) => (
                <p key={`warn-${i}`} className="text-[var(--muted)]">
                  {w}
                </p>
              ))}
                </div>
              </div>
            )}

          </div>
          {finished && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-default)] bg-[var(--color-surface)] p-5">
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                <ArrowLeft data-icon="inline-start" />
                Back to dashboard
              </Button>
              {finished !== "success" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (buildType === "migrate" && migrationProjectId) {
                      void deploy(true);
                    } else {
                      setFinished(null);
                      setStep(4);
                    }
                  }}
                >
                  {buildType === "migrate" && migrationProjectId
                    ? "Retry failed drafts"
                    : "Back to review"}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Wizard steps.
  return (
    <main className="page-body">
      <PageHead
        title="New Build"
        subline="Plan the destination pages, match source content, and prepare WordPress drafts."
        clientName={name || practiceMeta?.practiceName || "Untitled client"}
        buildTypeLabel={buildTypeLabel}
      >
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "-ml-0.5 h-auto self-stretch px-4"
          )}
        >
          Cancel
        </Link>
      </PageHead>

      <div className="grid overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-sm lg:grid-cols-[248px_minmax(0,1fr)]">
        <StepperRail step={step} setStep={setStep} />

        <section className="overflow-hidden bg-[var(--color-surface-raised)]">
          <PanelHead
            icon={STEP_DETAILS[step].icon}
            title={STEP_DETAILS[step].title}
            description={STEP_DETAILS[step].description}
          />
          <div className="space-y-7 bg-[var(--color-surface-raised)] p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-7">
              <SectionLabel>Website project</SectionLabel>
              <Field label="Practice name">
                <Input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!initialClient) setSlug(slugify(event.target.value));
                  }}
                />
              </Field>
              <Field label="Project slug" hint="Used as the saved client identifier.">
                <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSiteKind("existing")}
                  className={`rounded-lg border p-5 text-left shadow-xs transition-[border-color,background-color,box-shadow] ${siteKind === "existing" ? "border-[var(--color-primary)] bg-[var(--color-primary-tint)] ring-2 ring-[rgb(57_115_210_/_10%)]" : "border-[var(--color-border-default)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"}`}
                >
                  <span className="block text-sm font-bold">Existing website</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">Import content after the Page Plan is ready.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSiteKind("new")}
                  className={`rounded-lg border p-5 text-left shadow-xs transition-[border-color,background-color,box-shadow] ${siteKind === "new" ? "border-[var(--color-primary)] bg-[var(--color-primary-tint)] ring-2 ring-[rgb(57_115_210_/_10%)]" : "border-[var(--color-border-default)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"}`}
                >
                  <span className="block text-sm font-bold">New website</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">Create empty drafts without importing another site.</span>
                </button>
              </div>
              {siteKind === "existing" && (
                <Field label="Current website URL">
                  <Input
                    placeholder="https://example.com"
                    value={crawlUrl}
                    onChange={(event) => setCrawlUrl(event.target.value)}
                  />
                </Field>
              )}
            </div>
          )}

          {step === 1 && (
            <PagePlanWorkspace
              items={pagePlanItems}
              layouts={initialLayouts}
              practiceName={name}
              saveState={pagePlanSaveState}
              onChange={(items) => {
                setPagePlanItems(items);
                setContentMatches([]);
                setPagePlanSaveState(migrationProjectId ? "saving" : "idle");
              }}
            />
          )}

          {step === 2 && (
            <div className="space-y-6">
              {siteKind === "existing" && !sourceSaved && (
                <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] p-6 shadow-xs">
                  <h3 className="text-xl font-semibold tracking-[-0.02em]">Import the current website</h3>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--color-text-secondary)]">
                    The builder will find useful pages, clean crawl noise, and match content to your Page Plan automatically.
                  </p>
                  <div className="mt-5 flex flex-wrap items-end gap-3">
                    <div className="min-w-64 flex-1">
                      <Field label="Current website URL">
                        <Input value={crawlUrl} onChange={(event) => setCrawlUrl(event.target.value)} />
                      </Field>
                    </div>
                    <Button onClick={startCrawl} disabled={crawlStatus === "scraping" || savingCrawl}>
                      {crawlStatus === "scraping" || savingCrawl ? "Importing website" : "Start import"}
                    </Button>
                  </div>
                  {(crawlStatus !== "idle" || savingCrawl) && (
                    <div className="mt-5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-4" role="status">
                      <p className="text-sm font-bold">
                        {savingCrawl
                          ? "Matching content to your Page Plan"
                          : crawlStatus === "scraping"
                            ? `Finding website pages (${crawlProgress.completed} of ${crawlProgress.total || "more"})`
                            : crawlStatus === "failed"
                              ? "Website import stopped"
                              : "Cleaning crawl noise"}
                      </p>
                      {crawlError && <p className="mt-2 text-xs text-[var(--color-primary)]">{crawlError}</p>}
                    </div>
                  )}
                </div>
              )}

              {(siteKind === "new" || sourceSaved) && (
                <>
                  {siteKind === "existing" && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-success-tint)] p-5" role="status">
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-[var(--color-success)] text-[var(--color-on-primary)]">
                          <Check className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Website crawl complete</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                            {migrationSourcePages.length} page{migrationSourcePages.length === 1 ? " was" : "s were"} crawled and cleaned before matching.
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={startCrawl} disabled={crawlStatus === "scraping" || savingCrawl}>
                        Crawl website again
                      </Button>
                    </div>
                  )}
                  <ContentMatchWorkspace
                    pages={pagePlanItems}
                    matches={contentMatches}
                    savingPageId={savingContentMatchId}
                    onConfirm={confirmMatch}
                    onRemovePage={(pagePlanItemId) => {
                      const page = pagePlanItems.find((item) => item.id === pagePlanItemId);
                      if (!page || !window.confirm(`Remove ${page.pageName} from this Page Plan?`)) return;
                      setPagePlanItems((items) => items.filter((item) => item.id !== pagePlanItemId));
                      setContentMatches((items) => items.filter((item) => item.pagePlanItemId !== pagePlanItemId));
                      setPagePlanSaveState("saving");
                    }}
                  />
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-7">
              <SectionLabel>Practice details</SectionLabel>
              <Field label="Address"><Input value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
                <Field label="Email"><Input value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
              </div>
              <Field label="Hours"><Textarea value={hours} onChange={(event) => setHours(event.target.value)} rows={2} /></Field>
              <Field label="Booking link"><Input value={bookingLink} onChange={(event) => setBookingLink(event.target.value)} /></Field>
              <Field label="Social URLs" hint="One per line."><Textarea value={social} onChange={(event) => setSocial(event.target.value)} rows={3} /></Field>

              <SectionLabel>Brand kit</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(["primary", "secondary", "accent", "text", "background"] as const).map((key) => (
                  <ColorField key={key} label={key} value={colors[key]} onChange={(value) => setColors({ ...colors, [key]: value })} />
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FontSelect label="Heading font" value={fontHeading} onChange={setFontHeading} />
                <FontSelect label="Body font" value={fontBody} onChange={setFontBody} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FileField label="Logo" hint="Required. PNG, JPG, or SVG. Max 2MB." accept=".png,.jpg,.jpeg,.svg" preview={logo?.previewUrl} onFile={handleLogo} />
                <FileField label="Favicon" hint="Required. PNG or ICO. Max 500KB." accept=".png,.ico" preview={favicon?.previewUrl} onFile={handleFavicon} />
              </div>

              <SectionLabel>WordPress destination</SectionLabel>
              <Field label="WordPress site URL"><Input placeholder="https://client.example.com" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} /></Field>
              <Field label="WordPress username"><Input value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
              <Field
                label="Application password"
                hint={initialClient ? "Leave blank to reuse the stored, encrypted password." : "Stored encrypted and never returned to the browser."}
              >
                <Input type="password" value={appPassword} onChange={(event) => setAppPassword(event.target.value)} placeholder={initialClient ? "(unchanged)" : ""} />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-sm">
              <SectionLabel>Automatic final check</SectionLabel>
              <div
                className={`rounded-lg border p-5 ${
                  buildPlan?.status === "ready"
                    ? "border-[var(--color-success-dot)] bg-[var(--color-success-tint)]"
                    : "border-[var(--color-danger)] bg-[var(--color-danger-tint)]"
                }`}
                aria-live="polite"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {checkingBuild
                        ? "Checking every prepared page"
                        : buildPlan?.status === "ready"
                          ? `Ready to create ${buildPlan.items.length} WordPress drafts`
                          : "Final check needs attention"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {checkingBuild
                        ? "This check does not contact or change WordPress."
                        : buildPlan?.status === "ready"
                          ? "No source-layout residue or unsafe draft data was found."
                          : buildCheckError || "Return to the highlighted step and correct the issue."}
                    </p>
                  </div>
                  <Badge variant={buildPlan?.status === "ready" ? "secondary" : "destructive"}>
                    {checkingBuild ? "Checking" : buildPlan?.status === "ready" ? "Passed" : "Action needed"}
                  </Badge>
                </div>
                {!checkingBuild && buildPlan?.status !== "ready" && (
                  <Button className="mt-3" variant="outline" onClick={() => void runWebsiteDryRun()}>
                    Check again
                  </Button>
                )}
              </div>
              <SectionLabel>Website build summary</SectionLabel>
              <Review label="Project" value={name} onEdit={() => setStep(0)} />
              <Review label="Source" value={siteKind === "existing" ? "Existing website imported" : "New website with empty drafts"} onEdit={() => setStep(2)} />
              <Review
                label="Page Plan"
                onEdit={() => setStep(1)}
                value={<span className="flex flex-wrap gap-1">{pagePlanItems.map((page) => <Badge key={page.id} variant="secondary">{page.pageName}</Badge>)}</span>}
              />
              <Review
                label="Content"
                onEdit={() => setStep(2)}
                value={`${contentMatches.filter((match) => match.status === "matched").length} matched, ${contentMatches.filter((match) => match.status === "empty").length} empty drafts`}
              />
              <Review
                label="Content fit"
                onEdit={() => setStep(1)}
                value={`${preparedDrafts.filter((draft) => draft.status === "ready").length} of ${pagePlanItems.length} pages fitted into their selected layouts`}
              />
              <Review label="WordPress site" value={siteUrl} onEdit={() => setStep(3)} />
              <Review label="Fonts" value={`${fontHeading} / ${fontBody}`} onEdit={() => setStep(3)} />
              <Review
                label="Source check"
                value={
                  preparedDrafts.every((draft) => draft.residueReport.length === 0)
                    ? "No source-layout residue found"
                    : "A draft needs attention"
                }
                onEdit={() => setStep(1)}
              />
              <SectionLabel>Draft readiness</SectionLabel>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border-default)] shadow-xs">
                {pagePlanItems.map((page) => {
                  const draft = preparedDrafts.find((item) => item.pagePlanItemId === page.id);
                  return (
                    <div key={page.id} className="border-b border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-4 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-bold">{page.pageName}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{pagePath(page.slug)}</p>
                        </div>
                        <Badge variant={draft?.status === "ready" ? "secondary" : "destructive"}>
                          {draft?.status === "ready" ? "Ready" : "Needs attention"}
                        </Badge>
                      </div>
                      {draft?.notes.length ? (
                        <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-secondary)]">
                          {draft.notes.map((note) => <li key={note}>{note}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border-default)] bg-[var(--color-surface)] p-5">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <CheckCircle2 className="size-4 text-[var(--good)]" />
              <span>{name ? `Draft saved for ${name}` : "Draft saved in this session"}</span>
            </div>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => void next()}
                disabled={savingCrawl || preparingDrafts || (step === 1 && pagePlanSaveState === "saving")}
              >
                {savingCrawl
                  ? "Importing website"
                  : preparingDrafts
                    ? "Preparing drafts"
                  : step === 1 && pagePlanSaveState === "saving"
                    ? "Saving Page Plan"
                    : "Next"}
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                onClick={() => void deploy()}
                disabled={
                  buildType === "migrate" &&
                  deployMode === "pages" &&
                  (checkingBuild || buildPlan?.status !== "ready")
                }
              >
                {deployMode === "branding-only"
                  ? "Deploy brand kit"
                  : buildType === "migrate"
                    ? checkingBuild
                      ? "Checking build"
                      : buildPlan?.status === "ready"
                        ? "Create WordPress drafts"
                        : "Fix issues first"
                    : "Deploy"}
                <Rocket data-icon="inline-end" />
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[12px] font-medium text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 border border-[var(--line)] bg-[var(--paper-2)] p-3 transition-all duration-200 hover:border-[var(--line-strong)]">
      <Label className="text-[10px] uppercase tracking-[0.15em]">{label}</Label>
      <div className="flex items-center gap-3">
        <label
          className="relative flex size-10 shrink-0 cursor-pointer overflow-hidden border border-[var(--line-strong)]"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">{label} color picker</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 min-w-0 flex-1 font-mono text-[12px]"
        />
      </div>
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <Label>{label}</Label>
      <Combobox
        items={GOOGLE_FONTS}
        value={value}
        onValueChange={onChange}
        placeholder="Select a font"
        searchPlaceholder="Search fonts..."
        emptyMessage="No fonts match."
      />
    </div>
  );
}

function FileField({
  label,
  hint,
  accept,
  preview,
  onFile,
}: {
  label: string;
  hint?: string;
  accept: string;
  preview?: string;
  onFile: (file: File) => void | Promise<void>;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function loadFile(file: File | undefined) {
    if (!file) return;
    void Promise.resolve(onFile(file)).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Could not read file.");
    });
  }

  return (
    <div className="space-y-2.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) {
            return;
          }
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          loadFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-5 text-center transition-all duration-200 hover:border-[var(--secondary)] hover:bg-[var(--card)] ${
          dragging
            ? "border-[var(--secondary)] bg-[rgba(22,138,173,.08)]"
            : "border-[var(--line-strong)] bg-[var(--paper-2)]"
        }`}
      >
        <UploadCloud className="size-6 text-[var(--primary)]" />
        <span className="text-sm font-semibold text-[var(--ink)]">
          {preview ? "Replace file" : `Upload ${label.toLowerCase()}`}
        </span>
        {hint && <span className="text-xs font-medium text-[var(--muted)]">{hint}</span>}
        <span className="text-xs font-medium text-[var(--muted)]">
          Click or drop a file here.
        </span>
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          loadFile(file);
          e.currentTarget.value = "";
        }}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`${label} preview`}
          className="mt-2 h-16 w-auto border border-[var(--line)] bg-[var(--card)] p-1"
        />
      )}
    </div>
  );
}

function Review({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border border-[var(--line)] bg-[var(--paper-2)] p-4">
      <div className="flex min-w-0 gap-4">
        <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {label}
        </span>
        <span className="min-w-0 font-medium text-[var(--ink)]">{value}</span>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-[var(--primary-deep)] transition-colors hover:text-[var(--primary)]"
        >
          Edit
        </button>
      )}
    </div>
  );
}

function PageHead({
  title,
  subline,
  clientName,
  buildTypeLabel,
  children,
}: {
  title: string;
  subline: string;
  clientName: string;
  buildTypeLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-banner">
      <div>
        <div className="eyebrow">Build workspace</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{subline}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-pill bg-[var(--color-primary-tint)] px-3.5 py-2 text-xs font-semibold text-[var(--color-primary-hover)]">
          {buildTypeLabel}
        </div>
        <div className="rounded-pill border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-xs font-semibold text-[var(--color-text-secondary)]">
          {clientName}
        </div>
        {children}
      </div>
    </div>
  );
}

function StepperRail({
  step,
  setStep,
}: {
  step: number;
  setStep: (step: number) => void;
}) {
  const percent = Math.round(((step + 1) / STEPS.length) * 100);
  const estimate = Math.max(1, (STEPS.length - step) * 2);

  return (
    <aside className="border-r border-[var(--color-border-default)] bg-[var(--color-surface)] p-3 lg:self-stretch">
      <div className="px-3 py-3 text-xs font-semibold uppercase leading-none tracking-[0.04em] text-[var(--color-text-faint)]">
        Build steps
      </div>
      <ol className="space-y-1">
        {STEP_DETAILS.map((item, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={item.title}>
              <button
                type="button"
                disabled={i > step}
                aria-current={active ? "step" : undefined}
                onClick={() => i <= step && setStep(i)}
                className={`relative flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${
                  active
                    ? "border-l-[3px] border-l-[var(--color-primary)] bg-[var(--color-primary-tint)] pl-[10px]"
                    : done
                      ? "bg-transparent hover:bg-[var(--color-surface-raised)]"
                      : "cursor-default bg-transparent opacity-60"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold leading-none ${
                    done
                      ? "border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-on-primary)]"
                      : active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)]"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[13px] font-semibold leading-tight tracking-[-0.01em] ${
                      active ? "text-[var(--color-primary-hover)]" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-none text-[var(--color-text-faint)]">
                    {item.rail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 space-y-2 border-t border-[var(--color-border-default)] p-3 pt-4">
        <div className="h-2 overflow-hidden rounded-pill bg-[var(--color-border-default)]">
          <div
            role="progressbar"
            aria-label="Build setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-full rounded-pill bg-[var(--color-primary)] transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-[var(--color-text-faint)]">
          <span>{percent}% complete</span>
          <span>{estimate} min</span>
        </div>
      </div>
    </aside>
  );
}

function PanelHead({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="eyebrow mb-2">Current step</div>
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-[var(--color-text-primary)]">
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-xs font-semibold uppercase leading-none tracking-[0.04em] text-[var(--color-text-faint)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--color-border-default)]" />
    </div>
  );
}
