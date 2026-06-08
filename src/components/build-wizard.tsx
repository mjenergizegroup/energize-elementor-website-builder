"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe2,
  ListChecks,
  Palette,
  Rocket,
  UploadCloud,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOOGLE_FONTS } from "@/lib/google-fonts";
import type { BrandKit, UploadedAsset } from "@/lib/types";
import type { PageContent } from "@/lib/injection/types";
import type { ElevatePageType } from "@/lib/builders/elevate/types";

export interface ThemeSummary {
  key: string;
  label: string;
  ready: boolean;
  status: string;
  pages: { key: string; label: string }[];
}

export interface InitialClient {
  id: string;
  name: string;
  slug: string;
  theme: string;
  wpSiteUrl: string;
  wpUsername: string;
  brandKit: BrandKit;
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
}

interface CrawlPageEntry {
  url: string;
  title: string;
  markdown: string;
  metadata: Record<string, unknown>;
  recommended: boolean;
  skipReason?: string;
}

const STEPS = [
  "Crawl",
  "Theme",
  "Practice Info",
  "Brand Kit",
  "WP Target",
  "Content",
  "Review",
] as const;

const STEP_DETAILS: {
  title: (typeof STEPS)[number];
  rail: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Crawl",
    rail: "Source pages",
    description: "Collect source pages for cleanup when this is an existing website.",
    icon: Globe2,
  },
  {
    title: "Theme",
    rail: "Choose template",
    description: "Choose the Elementor theme and confirm page coverage.",
    icon: ClipboardList,
  },
  {
    title: "Practice Info",
    rail: "Client identity",
    description: "Set the client identity and production notes.",
    icon: UserRound,
  },
  {
    title: "Brand Kit",
    rail: "Colors and assets",
    description: "Capture colors, fonts, logo, and favicon for injection.",
    icon: Palette,
  },
  {
    title: "WP Target",
    rail: "Destination",
    description: "Add the WordPress destination and credentials.",
    icon: Globe2,
  },
  {
    title: "Content",
    rail: "Markdown source",
    description: "Upload approved markdown and select generated pages.",
    icon: FileText,
  },
  {
    title: "Review",
    rail: "Final check",
    description: "Confirm the build payload before deployment.",
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

function builderPageTypeFor(pageKey: string): ElevatePageType | undefined {
  if (pageKey === "insurance") return "insurance-and-financing";
  if (
    pageKey === "homepage" ||
    pageKey === "about" ||
    pageKey === "contact" ||
    pageKey === "amenities" ||
    pageKey === "first-visit" ||
    pageKey === "insurance-and-financing"
  ) {
    return pageKey;
  }
  return undefined;
}

export function BuildWizard({
  themes,
  initialClient,
  buildType = "new-website",
}: {
  themes: ThemeSummary[];
  initialClient?: InitialClient;
  buildType?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [siteKind, setSiteKind] = useState<"existing" | "new">("existing");
  const [crawlUrl, setCrawlUrl] = useState(initialClient?.wpSiteUrl ?? "");
  const [crawlJobId, setCrawlJobId] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<
    "idle" | "scraping" | "completed" | "failed"
  >("idle");
  const [crawlProgress, setCrawlProgress] = useState({ completed: 0, total: 0 });
  const [crawlKeep, setCrawlKeep] = useState<CrawlPageEntry[]>([]);
  const [crawlSkip, setCrawlSkip] = useState<CrawlPageEntry[]>([]);
  const [selectedCrawlUrls, setSelectedCrawlUrls] = useState<string[]>([]);
  const [crawlError, setCrawlError] = useState("");
  const [exportingCrawl, setExportingCrawl] = useState(false);

  const [theme, setTheme] = useState<string>(
    initialClient?.theme ??
      themes.find((t) => t.ready)?.key ??
      themes[0]?.key ??
      "",
  );

  const [name, setName] = useState(initialClient?.name ?? "");
  const [slug, setSlug] = useState(initialClient?.slug ?? "");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("");
  const [doctors, setDoctors] = useState<{ name: string; bio: string }[]>([
    { name: "", bio: "" },
  ]);
  const [services, setServices] = useState("");
  const [social, setSocial] = useState("");

  const [colors, setColors] = useState(
    initialClient?.brandKit.colors ?? DEFAULT_COLORS,
  );
  const [fontHeading, setFontHeading] = useState(
    initialClient?.brandKit.fonts.heading ?? "Poppins",
  );
  const [fontBody, setFontBody] = useState(
    initialClient?.brandKit.fonts.body ?? "Inter",
  );
  const [logo, setLogo] = useState<Asset | null>(() => {
    const asset = initialClient?.brandKit.logo;
    const previewUrl = previewUrlFromAsset(asset);
    return asset && previewUrl ? { ...asset, previewUrl } : null;
  });
  const [favicon, setFavicon] = useState<Asset | null>(() => {
    const asset = initialClient?.brandKit.favicon;
    const previewUrl = previewUrlFromAsset(asset);
    return asset && previewUrl ? { ...asset, previewUrl } : null;
  });

  const [siteUrl, setSiteUrl] = useState(initialClient?.wpSiteUrl ?? "");
  const [username, setUsername] = useState(initialClient?.wpUsername ?? "");
  const [appPassword, setAppPassword] = useState("");

  const [markdownName, setMarkdownName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [structuredResult, setStructuredResult] =
    useState<StructuredParseResult | null>(null);
  const [parserWarnings, setParserWarnings] = useState<string[]>([]);
  const [practiceMeta, setPracticeMeta] = useState<{
    practiceName: string;
    city?: string;
    doctorName?: string;
  } | null>(null);
  const [detectedPages, setDetectedPages] = useState<DetectedPage[]>([]);

  const selectedTheme = themes.find((t) => t.key === theme);
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
  const [finished, setFinished] = useState<null | "success" | "partial" | "failed">(
    null,
  );

  function updatePage(index: number, patch: Partial<DetectedPage>) {
    setDetectedPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  useEffect(() => {
    if (!crawlJobId || crawlStatus !== "scraping") return;
    void pollCrawl(crawlJobId);
    const timer = window.setInterval(() => {
      void pollCrawl(crawlJobId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [crawlJobId, crawlStatus]);

  async function startCrawl() {
    let normalizedUrl: string;
    try {
      const withProtocol = /^https?:\/\//i.test(crawlUrl)
        ? crawlUrl
        : `https://${crawlUrl}`;
      normalizedUrl = new URL(withProtocol).toString();
    } catch {
      toast.error("Enter a valid site URL.");
      return;
    }

    setCrawlUrl(normalizedUrl);
    setCrawlStatus("scraping");
    setCrawlJobId("");
    setCrawlProgress({ completed: 0, total: 0 });
    setCrawlKeep([]);
    setCrawlSkip([]);
    setSelectedCrawlUrls([]);
    setCrawlError("");

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not start crawl.");
        setCrawlStatus("idle");
        return;
      }
      setCrawlJobId(json.jobId);
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
      setCrawlProgress(json.progress ?? { completed: 0, total: 0 });
      setCrawlError(json.error ?? "");
      if (json.keep) {
        setCrawlKeep(json.keep);
        setSelectedCrawlUrls((prev) =>
          prev.length > 0 ? prev : json.keep.map((page: CrawlPageEntry) => page.url),
        );
      }
      if (json.skip) setCrawlSkip(json.skip);
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

  function toggleCrawlUrl(url: string, checked: boolean) {
    setSelectedCrawlUrls((prev) =>
      checked ? Array.from(new Set([...prev, url])) : prev.filter((item) => item !== url),
    );
  }

  function moveSkippedPageToKeep(url: string) {
    const page = crawlSkip.find((item) => item.url === url);
    if (!page) return;
    setCrawlSkip((prev) => prev.filter((item) => item.url !== url));
    setCrawlKeep((prev) => [...prev, { ...page, recommended: true, skipReason: undefined }]);
    toggleCrawlUrl(url, true);
  }

  async function exportCrawlMarkdown() {
    if (!crawlJobId) {
      toast.error("Start a crawl before exporting.");
      return;
    }
    if (selectedCrawlUrls.length === 0) {
      toast.error("Select at least one page to export.");
      return;
    }
    setExportingCrawl(true);
    try {
      const res = await fetch(`/api/crawl/${crawlJobId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedUrls: selectedCrawlUrls }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not export crawl markdown.");
        return;
      }
      const blob = new Blob([json.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = json.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${json.filename} exported.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export crawl markdown.");
    } finally {
      setExportingCrawl(false);
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

  async function handleMarkdown(file: File) {
    if (file.size > 1024 * 1024) {
      toast.error("Markdown file must be 1MB or smaller.");
      return;
    }
    const text = await file.text();
    setMarkdownName(file.name);
    setParsing(true);
    setDetectedPages([]);
    setPracticeMeta(null);
    setStructuredResult(null);
    setParserWarnings([]);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, markdown: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not parse the markdown.");
        return;
      }
      const result = json.result as StructuredParseResult;
      const normalPages = Object.entries(result.pages).map(([pageKey, pageData]) => {
        const title =
          (pageData.meta?.title as string | undefined) ??
          (pageData.hero?.heading as string | undefined) ??
          pageKey;
        return {
          page: pageKey,
          wpTitle: title,
          slug: slugify(pageKey),
          wpPageTemplate: "elementor_header_footer",
          slots: {},
          buildNotes: [],
          builderPageType: builderPageTypeFor(pageKey),
          pageData,
          selected: true,
        } satisfies DetectedPage;
      });
      const servicePages = Object.entries(result.service_pages).map(([slugKey, pageData]) => {
        const title =
          (pageData.meta?.title as string | undefined) ??
          (pageData.hero?.heading as string | undefined) ??
          slugKey;
        return {
          page: `service-page-${slugKey}`,
          wpTitle: title,
          slug: slugify(slugKey),
          wpPageTemplate: "elementor_header_footer",
          slots: {},
          buildNotes: [],
          builderPageType: "service-page",
          serviceSlug: slugKey,
          pageData,
          selected: true,
        } satisfies DetectedPage;
      });
      setPracticeMeta({
        practiceName: result.site.practice_name ?? result.site.site_name ?? name,
        city: result.site.city,
        doctorName: result.site.doctor_primary,
      });
      setStructuredResult(result);
      setParserWarnings(result.warnings ?? []);
      setDetectedPages([...normalPages, ...servicePages]);
      toast.success(
        `Parsed ${normalPages.length} pages and ${servicePages.length} service pages.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse the markdown.");
    } finally {
      setParsing(false);
    }
  }

  function validateStep(current: number): string | null {
    switch (current) {
      case 0:
        if (siteKind === "existing" && crawlStatus === "scraping")
          return "Wait for the crawl to finish or switch to a new website.";
        return null;
      case 1:
        if (!theme) return "Choose a theme.";
        if (selectedTheme && !selectedTheme.ready)
          return `The ${selectedTheme.label} theme is not ready yet (${selectedTheme.status}).`;
        return null;
      case 2:
        if (!name.trim()) return "Practice name is required.";
        if (!slug.trim()) return "Slug is required.";
        return null;
      case 3:
        if (!logo?.dataBase64) return "Site logo is required.";
        if (!favicon?.dataBase64) return "Site favicon is required.";
        return null;
      case 4:
        if (!siteUrl.trim()) return "WordPress site URL is required.";
        if (!username.trim()) return "WordPress username is required.";
        if (!initialClient && !appPassword.trim())
          return "Application password is required for a new client.";
        return null;
      case 5:
        if (!markdownName) return "Upload the approved markdown content.";
        if (detectedPages.length === 0)
          return "No pages were detected. Check that the markdown matches the selected theme.";
        if (!detectedPages.some((p) => p.selected))
          return "Select at least one page to build.";
        return null;
      default:
        return null;
    }
  }

  function next() {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
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

  async function deploy() {
    const error = [1, 2, 3, 4, 5].map(validateStep).find(Boolean);
    if (error) {
      toast.error(error);
      return;
    }
    setDeploying(true);
    setEvents([]);
    setDeployedLinks([]);
    setBuildNotes([]);
    setWarnings([]);
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

    const pages = detectedPages
      .filter((p) => p.selected)
      .map((p) => ({
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
    if (structuredResult) {
      const unsupported = pages.find((p) => !p.builderPageType || !p.pageData);
      if (unsupported) {
        toast.error(`No Elevate builder is mapped for ${unsupported.page}.`);
        setDeploying(false);
        return;
      }
    }
    const content = {
      practiceName: practiceMeta?.practiceName ?? name,
      city: practiceMeta?.city,
      doctorName: practiceMeta?.doctorName,
      site: structuredResult?.site,
      pages,
    };

    try {
      // Stream the deploy.
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: initialClient?.id,
          client: {
            name,
            slug,
            theme,
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
          } else {
            if (event.status === "fail") sawFail = true;
            upsertEvent(event.label, event.status, event.message);
            if (event.step === "page" && event.status === "ok" && event.data?.wpPageId) {
              setDeployedLinks((prev) => [
                ...prev,
                {
                  wpPageId: event.data.wpPageId,
                  title: event.data.title ?? event.data.page,
                  editUrl: event.data.editUrl,
                  viewUrl: event.data.viewUrl,
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
      finished === "success"
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
          subline="The deploy stream reports every WordPress and brand-kit step."
          clientName={name || practiceMeta?.practiceName || "Untitled client"}
          themeLabel={selectedTheme?.label ?? theme}
          buildTypeLabel={buildTypeLabel}
        />

        <section className="wizard-frame">
          <PanelHead
            icon={Rocket}
            title="Deployment progress"
            description="Routes, page drafts, assets, and Elementor cache status."
          />
          <div className="space-y-6 bg-[var(--color-surface)] p-6 sm:p-8">
            <ul className="space-y-2 text-sm">
              {events.map((e) => (
                <li
                  key={e.key}
                  className="flex items-start gap-3 border-2 border-[var(--color-black)] bg-[var(--color-panel)] px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 border-[var(--color-black)] text-xs font-bold ${
                      e.status === "ok"
                        ? "bg-[var(--color-black)] text-[var(--color-on-black)]"
                        : e.status === "fail"
                          ? "bg-[var(--color-red-light)] text-[var(--color-red)]"
                          : "bg-[var(--color-surface)] text-[var(--color-muted)]"
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
                <li className="border-2 border-[var(--color-black)] bg-[var(--color-panel)] px-3 py-2.5 text-[var(--color-muted)]">
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
                    <a
                      href={l.editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="border-2 border-[var(--color-black)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-red)]"
                    >
                      Edit in WP
                    </a>
                    <a
                      href={l.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="border-2 border-[var(--color-black)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-red)]"
                    >
                      Preview
                    </a>
                  </li>
                ))}
              </ul>
              </div>
            )}

            {(buildNotes.length > 0 || warnings.length > 0) && (
              <div className="space-y-3">
                <SectionLabel>Build notes for David&apos;s team</SectionLabel>
                <div className="space-y-2 border-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4 text-sm leading-6">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--color-black)] bg-[var(--color-panel)] p-5">
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                <ArrowLeft data-icon="inline-start" />
                Back to dashboard
              </Button>
              {finished !== "success" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFinished(null);
                    setStep(5);
                  }}
                >
                  Back to review
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
        subline="Run one client through theme, brand, WordPress, content, and review."
        clientName={name || practiceMeta?.practiceName || "Untitled client"}
        themeLabel={selectedTheme?.label ?? theme}
        buildTypeLabel={buildTypeLabel}
      >
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
      </PageHead>

      <div className="grid gap-0 border-2 border-[var(--color-black)] bg-[var(--color-surface)] lg:grid-cols-[230px_minmax(0,1fr)]">
        <StepperRail step={step} setStep={setStep} />

        <section className="overflow-hidden bg-[var(--color-surface)]">
          <PanelHead
            icon={STEP_DETAILS[step].icon}
            title={STEP_DETAILS[step].title}
            description={STEP_DETAILS[step].description}
          />
          <div className="space-y-7 bg-[var(--color-surface)] p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-6">
              <SectionLabel>Crawl source</SectionLabel>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSiteKind("existing")}
                  className={` border p-4 text-left transition ${
                    siteKind === "existing"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--line)] bg-[var(--paper-2)]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[var(--ink)]">
                    Existing website
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-[var(--muted)]">
                    Crawl source pages and export raw markdown for cleanup.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSiteKind("new")}
                  className={` border p-4 text-left transition ${
                    siteKind === "new"
                      ? "border-[var(--primary)] bg-[var(--primary)]/10"
                      : "border-[var(--line)] bg-[var(--paper-2)]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[var(--ink)]">
                    New website
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-[var(--muted)]">
                    Skip crawl and continue to the builder setup.
                  </span>
                </button>
              </div>

              {siteKind === "existing" && (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Field label="Website URL">
                      <Input
                        placeholder="https://example.com"
                        value={crawlUrl}
                        onChange={(e) => setCrawlUrl(e.target.value)}
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={startCrawl}
                        disabled={crawlStatus === "scraping"}
                      >
                        {crawlStatus === "scraping" ? "Crawling" : "Start Crawl"}
                      </Button>
                    </div>
                  </div>

                  {crawlStatus !== "idle" && (
                    <div className=" border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm">
                      <p className="font-semibold text-[var(--ink)]">
                        {crawlStatus === "scraping"
                          ? `Crawled ${crawlProgress.completed} / ${crawlProgress.total || "..."} pages`
                          : crawlStatus === "completed"
                            ? `Crawl complete: ${crawlKeep.length} kept, ${crawlSkip.length} skipped`
                            : "Crawl failed"}
                      </p>
                      {crawlError && (
                        <p className="mt-2 text-destructive">{crawlError}</p>
                      )}
                    </div>
                  )}

                  {(crawlKeep.length > 0 || crawlSkip.length > 0) && (
                    <div className="grid gap-5 xl:grid-cols-2">
                      <div className="space-y-3">
                        <SectionLabel>Keep</SectionLabel>
                        <div className="max-h-[420px] space-y-2 overflow-auto border border-[var(--line)] bg-[var(--paper-2)] p-3">
                          {crawlKeep.map((page) => (
                            <label
                              key={page.url}
                              className="flex gap-3 bg-[var(--card)] p-3 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCrawlUrls.includes(page.url)}
                                onChange={(e) => toggleCrawlUrl(page.url, e.target.checked)}
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-[var(--ink)]">
                                  {page.title}
                                </span>
                                <span className="block truncate text-xs text-[var(--muted)]">
                                  {page.url}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <SectionLabel>Skipped</SectionLabel>
                        <div className="max-h-[420px] space-y-2 overflow-auto border border-[var(--line)] bg-[var(--paper-2)] p-3">
                          {crawlSkip.map((page) => (
                            <div
                              key={page.url}
                              className=" bg-[var(--card)] p-3 text-sm opacity-70"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-[var(--ink)]">
                                    {page.title}
                                  </span>
                                  <span className="block truncate text-xs text-[var(--muted)]">
                                    {page.url}
                                  </span>
                                  {page.skipReason && (
                                    <span className="mt-1 block text-xs text-[var(--muted)]">
                                      {page.skipReason}
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => moveSkippedPageToKeep(page.url)}
                                  className="shrink-0 text-xs font-semibold text-[var(--primary-deep)]"
                                >
                                  Move to keep
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {crawlKeep.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[var(--paper-2)] p-4">
                      <p className="text-sm font-medium text-[var(--muted)]">
                        Upload this file to the Claude.ai cleanup Project, then bring the cleaned output back here for the Content step.
                      </p>
                      <Button
                        type="button"
                        onClick={exportCrawlMarkdown}
                        disabled={exportingCrawl}
                      >
                        {exportingCrawl ? "Exporting" : "Export Combined File"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <SectionLabel>Theme setup</SectionLabel>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={theme} onValueChange={(v) => v && setTheme(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((t) => (
                      <SelectItem key={t.key} value={t.key} disabled={!t.ready}>
                        {t.label}
                        {t.ready ? "" : ` (${t.status})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTheme && (
                <div className="space-y-3 border border-[var(--line)] bg-[var(--paper-2)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                    Pages produced
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTheme.pages.length > 0 ? (
                      selectedTheme.pages.map((p) => (
                        <Badge key={p.key} variant="secondary">
                          {p.label}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--muted)]">none</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <SectionLabel>Practice details</SectionLabel>
              <Field label="Practice name">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!initialClient) setSlug(slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="Slug" hint="Used as the saved client identifier.">
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </Field>
              <Field label="Address">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              </div>
              <Field label="Hours">
                <Textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={2} />
              </Field>
              <SectionLabel>Doctors</SectionLabel>
              <div className="space-y-3">
                {doctors.map((doc, i) => (
                  <div key={i} className="space-y-3 border border-[var(--line)] bg-[var(--paper-2)] p-4">
                    <Input
                      placeholder="Name"
                      value={doc.name}
                      onChange={(e) => {
                        const copy = [...doctors];
                        copy[i] = { ...copy[i], name: e.target.value };
                        setDoctors(copy);
                      }}
                    />
                    <Textarea
                      placeholder="Bio"
                      rows={2}
                      value={doc.bio}
                      onChange={(e) => {
                        const copy = [...doctors];
                        copy[i] = { ...copy[i], bio: e.target.value };
                        setDoctors(copy);
                      }}
                    />
                    {doctors.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDoctors(doctors.filter((_, j) => j !== i))}
                      >
                        <ArrowLeft data-icon="inline-start" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDoctors([...doctors, { name: "", bio: "" }])}
                >
                  Add doctor
                </Button>
              </div>
              <SectionLabel>Production notes</SectionLabel>
              <Field label="Services" hint="One per line.">
                <Textarea value={services} onChange={(e) => setServices(e.target.value)} rows={4} />
              </Field>
              <Field label="Social URLs" hint="One per line.">
                <Textarea value={social} onChange={(e) => setSocial(e.target.value)} rows={3} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <SectionLabel>Color palette</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(
                  ["primary", "secondary", "accent", "text", "background"] as const
                ).map((key) => (
                  <ColorField
                    key={key}
                    label={key}
                    value={colors[key]}
                    onChange={(v) => setColors({ ...colors, [key]: v })}
                  />
                ))}
              </div>
              <SectionLabel>Typography</SectionLabel>
              <div className="grid gap-4 md:grid-cols-2">
                <FontSelect label="Heading font" value={fontHeading} onChange={setFontHeading} />
                <FontSelect label="Body font" value={fontBody} onChange={setFontBody} />
              </div>
              <SectionLabel>Assets</SectionLabel>
              <div className="grid gap-4 md:grid-cols-2">
                <FileField
                  label="Logo"
                  hint="Required. PNG, JPG, or SVG. Max 2MB."
                  accept=".png,.jpg,.jpeg,.svg"
                  preview={logo?.previewUrl}
                  onFile={handleLogo}
                />
                <FileField
                  label="Favicon"
                  hint="Required. PNG or ICO. Max 500KB."
                  accept=".png,.ico"
                  preview={favicon?.previewUrl}
                  onFile={handleFavicon}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <SectionLabel>WordPress destination</SectionLabel>
              <Field label="WordPress site URL">
                <Input
                  placeholder="https://client.example.com"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                />
              </Field>
              <Field label="WordPress username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field
                label="Application password"
                hint={
                  initialClient
                    ? "Leave blank to reuse the stored, encrypted password."
                    : "Stored encrypted (AES-256-GCM). Never sent to the browser again."
                }
              >
                <Input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder={initialClient ? "(unchanged)" : ""}
                />
              </Field>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <SectionLabel>Markdown source</SectionLabel>
              <FileField
                label="Approved content markdown"
                hint="Output from the dental-content-writer skill. Max 1MB."
                accept=".md,.markdown,.txt"
                onFile={handleMarkdown}
              />
              {parsing && (
                <p className="text-sm font-medium text-[var(--muted)]">Parsing {markdownName}...</p>
              )}
              {!parsing && practiceMeta && (
                <p className="font-mono text-xs font-medium text-[var(--muted)]">
                  Parsed {markdownName}: {practiceMeta.practiceName}
                  {practiceMeta.doctorName ? ` · ${practiceMeta.doctorName}` : ""}
                  {practiceMeta.city ? ` · ${practiceMeta.city}` : ""}
                </p>
              )}
              {parserWarnings.length > 0 && (
                <div className="space-y-2 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Parser warnings</p>
                  <ul className="list-inside list-disc space-y-1">
                    {parserWarnings.map((warning, i) => (
                      <li key={`parser-warning-${i}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {structuredResult && (
                <div className="space-y-4 border border-[var(--line)] bg-[var(--paper-2)] p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {Object.keys(structuredResult.pages).length} pages
                    </Badge>
                    <Badge variant="secondary">
                      {Object.keys(structuredResult.service_pages).length} service pages
                    </Badge>
                    <Badge variant="outline">
                      {parserWarnings.length} warnings
                    </Badge>
                  </div>
                  <pre className="max-h-72 overflow-auto border border-[var(--line)] bg-[var(--card)] p-4 text-xs leading-5 text-[var(--ink)]">
                    {JSON.stringify(
                      {
                        site: structuredResult.site,
                        pages: structuredResult.pages,
                        service_pages: structuredResult.service_pages,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
              {detectedPages.length > 0 && (
                <>
                  <SectionLabel>
                    {structuredResult ? "Parsed pages" : "Detected pages to build"}
                  </SectionLabel>
                  <div className="space-y-3">
                    {detectedPages.map((p, i) => {
                      const slotCount = Object.keys(p.slots).length;
                      return (
                        <div key={`${p.page}-${i}`} className="space-y-3 border border-[var(--line)] bg-[var(--paper-2)] p-4">
                          <label className="flex items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              checked={p.selected}
                              onChange={(e) => updatePage(i, { selected: e.target.checked })}
                            />
                            {p.page}
                            <span className="text-xs font-normal text-muted-foreground">
                              {structuredResult ? "ready for builder" : `${slotCount} fields`}
                              {!structuredResult && p.buildNotes && p.buildNotes.length > 0
                                ? ` · ${p.buildNotes.length} flags`
                                : ""}
                            </span>
                          </label>
                          {p.selected && (
                            <div className="grid gap-3 md:grid-cols-2">
                              <Input
                                value={p.wpTitle ?? ""}
                                onChange={(e) => updatePage(i, { wpTitle: e.target.value })}
                                placeholder="WP page title"
                              />
                              <Input
                                value={p.slug ?? ""}
                                onChange={(e) => updatePage(i, { slug: slugify(e.target.value) })}
                                placeholder="slug"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 text-sm">
              <SectionLabel>Build summary</SectionLabel>
              <Review
                label="Source"
                value={siteKind === "existing" ? "Existing website" : "New website"}
                onEdit={() => setStep(0)}
              />
              <Review label="Theme" value={selectedTheme?.label ?? theme} onEdit={() => setStep(1)} />
              <Review label="Site name" value={name} onEdit={() => setStep(2)} />
              <Review label="Practice slug" value={slug} onEdit={() => setStep(2)} />
              <Review label="WP site" value={siteUrl} onEdit={() => setStep(4)} />
              <Review
                label="Brand colors"
                onEdit={() => setStep(3)}
                value={
                  <span className="flex gap-1">
                    {Object.values(colors).map((c, i) => (
                      <span
                        key={i}
                        className="inline-block h-4 w-4 rounded border"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </span>
                }
              />
              <Review label="Fonts" value={`${fontHeading} / ${fontBody}`} onEdit={() => setStep(3)} />
              <Review label="Site logo" value={logo ? logo.filename : "none"} onEdit={() => setStep(3)} />
              <Review label="Site favicon" value={favicon ? favicon.filename : "none"} onEdit={() => setStep(3)} />
              <Review label="Content" value={markdownName || "none"} onEdit={() => setStep(5)} />
              {structuredResult && (
                <>
                  <Review
                    label="Parser result"
                    value={`${Object.keys(structuredResult.pages).length} pages, ${Object.keys(structuredResult.service_pages).length} service pages`}
                    onEdit={() => setStep(5)}
                  />
                  <Review
                    label="Builder"
                    value="Elevate builder connected"
                    onEdit={() => setStep(5)}
                  />
                </>
              )}
              <Review
                label="Pages"
                onEdit={() => setStep(5)}
                value={
                  <span className="flex flex-wrap gap-1">
                    {detectedPages
                      .filter((p) => p.selected)
                      .map((p, i) => (
                        <Badge key={`${p.page}-${i}`} variant="secondary">
                          {p.wpTitle || p.page}
                        </Badge>
                      ))}
                  </span>
                }
              />
            </div>
          )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-[var(--color-black)] bg-[var(--color-panel)] p-5">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <CheckCircle2 className="size-4 text-[var(--good)]" />
              <span>{name ? `Draft saved for ${name}` : "Draft saved in this session"}</span>
            </div>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Next
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button onClick={deploy}>
                Deploy
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
    <div className="flex items-center gap-3 border border-[var(--line)] bg-[var(--paper-2)] p-3 transition-all duration-200 hover:border-[var(--line-strong)]">
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
      <div className="min-w-0 flex-1 space-y-1">
        <Label className="text-[10px] uppercase tracking-[0.15em]">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-[12px]"
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
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GOOGLE_FONTS.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  themeLabel,
  buildTypeLabel,
  children,
}: {
  title: string;
  subline: string;
  clientName: string;
  themeLabel: string;
  buildTypeLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-banner">
      <div>
        <div className="eyebrow">{"// Build Workspace"}</div>
        <h1 className="page-title">{title}.</h1>
        <p className="page-copy">{subline}</p>
      </div>
      <div className="flex flex-wrap items-center gap-0">
        <div className="border-2 border-[var(--color-black)] bg-[var(--color-red)] px-4 py-3 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-on-red)]">
          {buildTypeLabel}
        </div>
        <div className="-ml-0.5 border-2 border-[var(--color-black)] bg-[var(--color-surface)] px-4 py-3 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-black)]">
          {clientName}
          <span className="ml-3 text-[var(--color-muted)]">
            {themeLabel || "Theme pending"}
          </span>
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
    <aside className="border-r-2 border-[var(--color-black)] bg-[var(--color-surface)] lg:self-stretch">
      <div className="bg-[var(--color-black)] px-4 py-3 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-on-black)]">
        {"// Build Steps"}
      </div>
      <ol>
        {STEP_DETAILS.map((item, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={item.title}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => i <= step && setStep(i)}
                className={`relative flex w-full items-center gap-3 border-b border-[var(--color-black)] px-4 py-[14px] text-left transition-colors ${
                  active
                    ? "border-l-[3px] border-l-[var(--color-red)] bg-[var(--color-red-light)] pl-[13px]"
                    : done
                      ? "bg-[var(--color-surface)] hover:bg-[var(--color-panel)]"
                      : "cursor-default bg-[var(--color-surface)] opacity-60"
                }`}
              >
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center border-2 text-[10px] font-bold leading-none tracking-[0.12em] ${
                    done
                      ? "border-[var(--color-black)] bg-[var(--color-black)] text-[var(--color-on-black)]"
                      : active
                        ? "border-[var(--color-red)] bg-[var(--color-red)] text-[var(--color-on-red)]"
                        : "border-[var(--color-black)] bg-[var(--color-surface)] text-[var(--color-muted)]"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[13px] font-semibold leading-tight tracking-[-0.01em] ${
                      active ? "text-[var(--color-black)]" : "text-[var(--color-black)]"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--color-muted)]">
                    {item.rail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="space-y-2 border-t-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4">
        <div className="h-1 overflow-hidden bg-[#E0DDD6]">
          <div
            className="h-full bg-[var(--color-red)] transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
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
    <div className="flex items-center gap-4 border-b-2 border-[var(--color-black)] bg-[var(--color-panel)] p-5 sm:p-6">
      <div className="flex size-[42px] shrink-0 items-center justify-center border-2 border-[var(--color-black)] bg-[var(--color-surface)] text-[var(--color-red)]">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="eyebrow mb-2">{"// Step"}</div>
        <h2 className="text-[32px] font-black leading-none tracking-[-0.04em] text-[var(--color-black)]">
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--color-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-red)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--color-hairline)]" />
    </div>
  );
}
