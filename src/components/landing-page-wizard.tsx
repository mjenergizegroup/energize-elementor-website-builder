"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileJson,
  Globe2,
  Palette,
  Rocket,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InitialClient } from "@/components/build-wizard";
import { cn } from "@/lib/utils";
import { GOOGLE_FONTS } from "@/lib/google-fonts";
import type { BrandColors, BrandKit, UploadedAsset } from "@/lib/types";

type TemplateName =
  | "std_v1"
  | "std_v2"
  | "inv_v1"
  | "inv_v2"
  | "fa_v1"
  | "fa_v2"
  | "thank_you";

interface BuildPackagePage {
  page_type: string;
  template: TemplateName;
  slots: Record<string, unknown>;
}

interface BuildPackage {
  client: string;
  built_at?: string;
  pages: BuildPackagePage[];
}

interface DeployEvent {
  type: "step" | "done" | "fatal";
  status: "start" | "ok" | "fail";
  label: string;
  message?: string;
  data?: {
    page?: string;
    title?: string;
    wpPageId?: number;
    editUrl?: string;
    viewUrl?: string;
  };
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

type Asset = UploadedAsset & { previewUrl: string };

const STEPS = ["Content", "Brand Kit", "WP Target", "Review", "Deploy"] as const;

const STEP_DETAILS: {
  title: (typeof STEPS)[number];
  rail: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Content",
    rail: "Build package",
    description: "Upload the combined landing page JSON package.",
    icon: FileJson,
  },
  {
    title: "Brand Kit",
    rail: "Variables and assets",
    description: "Map brand values to Atomic variables, then add the logo and favicon.",
    icon: Palette,
  },
  {
    title: "WP Target",
    rail: "Destination",
    description: "Add the WordPress destination and credentials.",
    icon: Globe2,
  },
  {
    title: "Review",
    rail: "Final check",
    description: "Confirm pages, slot coverage, colors, and target site.",
    icon: CheckCircle2,
  },
  {
    title: "Deploy",
    rail: "Draft push",
    description: "Push filled landing pages to WordPress as drafts.",
    icon: Rocket,
  },
];

const TEMPLATE_NAMES: TemplateName[] = [
  "std_v1",
  "std_v2",
  "inv_v1",
  "inv_v2",
  "fa_v1",
  "fa_v2",
  "thank_you",
];

const TEMPLATE_LABELS: Record<TemplateName, string> = {
  std_v1: "Standard V1",
  std_v2: "Standard V2",
  inv_v1: "Invisalign V1",
  inv_v2: "Invisalign V2",
  fa_v1: "Full Arch V1",
  fa_v2: "Full Arch V2",
  thank_you: "Thank You",
};

const DEFAULT_COLORS = {
  primary: "#1e6091",
  secondary: "#168aad",
  accent: "#d9a566",
  text: "#191919",
  background: "#FFFFFF",
};

const DEFAULT_HIGHLIGHT = "#2a9d8f";

// Every landing page build ships with a Thank You page. When the Build
// Package does not include one, these defaults fill the template so the
// leftover demo content (including its website link) never goes live.
function defaultThankYouSlots(siteUrl: string): Record<string, unknown> {
  const url = siteUrl.trim().replace(/\/+$/, "");
  return {
    THANK_YOU_HEADING: "Thank You for Contacting Us!",
    THANK_YOU_BODY:
      "<p>We received your request. Our team will reach out shortly to confirm your appointment.</p>",
    WEBSITE_URL: `<p style="text-align: center;">Please feel free to explore our <strong><a href="${url}" target="_blank" rel="noopener noreferrer">website</a></strong> for more information about our services, our team, and our philosophy.</p>`,
  };
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTemplateName(value: unknown): value is TemplateName {
  return typeof value === "string" && TEMPLATE_NAMES.includes(value as TemplateName);
}

function parseBuildPackage(text: string): BuildPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Upload a valid JSON file.");
  }

  if (!isObject(parsed)) {
    throw new Error("Build Package must be a JSON object.");
  }
  if (typeof parsed.client !== "string" || !parsed.client.trim()) {
    throw new Error("Build Package must include a client name.");
  }
  if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error("Build Package must include a pages array.");
  }

  const pages = parsed.pages.map((page, index): BuildPackagePage => {
    if (!isObject(page)) {
      throw new Error(`Page ${index + 1} must be an object.`);
    }
    if (typeof page.page_type !== "string" || !page.page_type.trim()) {
      throw new Error(`Page ${index + 1} must include page_type.`);
    }
    if (!isTemplateName(page.template)) {
      throw new Error(`Page ${index + 1} has an unsupported template.`);
    }
    if (!isObject(page.slots)) {
      throw new Error(`Page ${index + 1} must include a slots object.`);
    }
    return {
      page_type: page.page_type,
      template: page.template,
      slots: page.slots,
    };
  });

  return {
    client: parsed.client.trim(),
    built_at: typeof parsed.built_at === "string" ? parsed.built_at : undefined,
    pages,
  };
}

export function LandingPageWizard({
  initialClient,
  embedded = false,
}: {
  initialClient?: InitialClient;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [buildPackage, setBuildPackage] = useState<BuildPackage | null>(null);
  const [packageFilename, setPackageFilename] = useState("");
  const [packageError, setPackageError] = useState("");
  const [colors, setColors] = useState(
    initialClient?.brandKit.colors ?? DEFAULT_COLORS,
  );
  const [useAccent, setUseAccent] = useState(() => {
    const stored = initialClient?.brandKit.colors;
    return stored ? stored.accent !== stored.secondary : false;
  });
  const [useHighlight, setUseHighlight] = useState(
    Boolean(initialClient?.brandKit.colors.highlight),
  );
  const [highlight, setHighlight] = useState(
    initialClient?.brandKit.colors.highlight ?? DEFAULT_HIGHLIGHT,
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
  const [name, setName] = useState(initialClient?.name ?? "");
  const [slug, setSlug] = useState(initialClient?.slug ?? "");
  const [siteUrl, setSiteUrl] = useState(initialClient?.wpSiteUrl ?? "");
  const [username, setUsername] = useState(initialClient?.wpUsername ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [events, setEvents] = useState<StepEvent[]>([]);
  const [deployedLinks, setDeployedLinks] = useState<DeployedLink[]>([]);
  const [finished, setFinished] = useState<null | "success" | "partial" | "failed">(
    null,
  );

  async function handleBuildPackage(file: File) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      setPackageError("Upload a .json file.");
      setBuildPackage(null);
      return;
    }
    if (file.size > 1024 * 1024) {
      setPackageError("JSON file must be 1MB or smaller.");
      setBuildPackage(null);
      return;
    }

    try {
      const parsed = parseBuildPackage(await file.text());
      setBuildPackage(parsed);
      setPackageFilename(file.name);
      setPackageError("");
      if (!name.trim()) setName(parsed.client);
      if (!slug.trim() && !initialClient) setSlug(slugify(parsed.client));
      toast.success(`${file.name} loaded.`);
    } catch (e) {
      setBuildPackage(null);
      setPackageFilename(file.name);
      setPackageError(e instanceof Error ? e.message : "Could not parse Build Package.");
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

  function buildColors(): BrandColors {
    return {
      primary: colors.primary,
      secondary: colors.secondary,
      // When accent is not used the accent slot falls back to secondary so
      // templates referencing it stay on brand.
      accent: useAccent ? colors.accent : colors.secondary,
      text: colors.text,
      background: colors.background,
      ...(useHighlight ? { highlight } : {}),
    };
  }

  function buildBrandKit(): BrandKit {
    return {
      colors: buildColors(),
      fonts: { heading: fontHeading, body: fontBody },
      logo: {
        filename: logo!.filename,
        dataBase64: logo!.dataBase64,
      },
      favicon: {
        filename: favicon!.filename,
        dataBase64: favicon!.dataBase64,
      },
    };
  }

  function validateStep(current: number): string | null {
    switch (current) {
      case 0:
        if (!buildPackage) return "Upload a valid Build Package JSON file.";
        return null;
      case 1:
        if (!colors.primary || !colors.secondary)
          return "Choose primary and secondary colors.";
        if (useAccent && !colors.accent)
          return "Choose an accent color or uncheck it.";
        if (useHighlight && !highlight)
          return "Choose a highlight color or uncheck it.";
        if (!logo?.dataBase64) return "Site logo is required.";
        if (!favicon?.dataBase64) return "Site favicon is required.";
        return null;
      case 2:
        if (!name.trim()) return "Practice name is required.";
        if (!slug.trim()) return "Slug is required.";
        if (!siteUrl.trim()) return "WordPress site URL is required.";
        if (!username.trim()) return "WordPress username is required.";
        if (!initialClient && !appPassword.trim())
          return "Application password is required for a new client.";
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
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function back() {
    setStep((value) => Math.max(value - 1, 0));
  }

  function upsertEvent(label: string, status: StepEvent["status"], message?: string) {
    setEvents((prev) => {
      const idx = [...prev].reverse().findIndex((event) => event.label === label);
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
    const error = [0, 1, 2].map(validateStep).find(Boolean);
    if (error) {
      toast.error(error);
      return;
    }
    if (!buildPackage) return;

    setDeploying(true);
    setFinished(null);
    setEvents([]);
    setDeployedLinks([]);

    try {
      const res = await fetch("/api/landing-pages/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: initialClient?.id,
          client: {
            name,
            slug,
            wpSiteUrl: siteUrl,
            wpUsername: username,
            wpAppPassword: appPassword || undefined,
          },
          brandKit: buildBrandKit(),
          pages: [
            ...buildPackage.pages.map((page) => ({
              pageName: page.page_type,
              pageTitle: page.page_type,
              slug: slugify(page.page_type === "Thank You" ? "thank-you" : page.page_type),
              templateName: page.template,
              contentJson: page.slots,
            })),
            ...(buildPackage.pages.some((page) => page.template === "thank_you")
              ? []
              : [
                  {
                    pageName: "Thank You",
                    pageTitle: "Thank You",
                    slug: "thank-you",
                    templateName: "thank_you" as TemplateName,
                    contentJson: defaultThankYouSlots(siteUrl),
                  },
                ]),
          ],
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        const detail = typeof err.detail === "string" ? ` ${err.detail}` : "";
        toast.error(`${err.error ?? `Deploy failed (status ${res.status}).`}${detail}`);
        setFinished("failed");
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
          const event = JSON.parse(line) as DeployEvent;
          if (event.type === "fatal") {
            sawFatal = true;
            upsertEvent(event.label, "fail", event.message);
            continue;
          }
          if (event.status === "fail") sawFail = true;
          if (event.type !== "done") {
            upsertEvent(event.label, event.status, event.message);
          }
          if (event.status === "ok" && event.data?.wpPageId) {
            setDeployedLinks((prev) => [
              ...prev,
              {
                wpPageId: event.data!.wpPageId!,
                title: event.data!.title ?? event.data!.page ?? "Draft page",
                editUrl: event.data!.editUrl!,
                viewUrl: event.data!.viewUrl!,
              },
            ]);
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

  const showingDeploy = deploying || finished || step === 4;

  if (showingDeploy) {
    const title =
      finished === "success"
        ? "Deploy complete"
        : finished === "partial"
          ? "Deploy finished with issues"
          : finished === "failed"
            ? "Deploy failed"
            : "Deploying";

    return (
      <div className={embedded ? "drawer-build-workspace" : "page-body"}>
        {!embedded ? (
          <PageHead
            title={title}
            subline="Landing pages are generated with Atomic elements and pushed as Elementor drafts."
            clientName={name || buildPackage?.client || "Untitled client"}
          />
        ) : null}
        <section className="wizard-frame">
          <PanelHead
            icon={Rocket}
            title="Deployment progress"
            description="Each landing page from the Build Package is injected and pushed in sequence."
          />
          <div className="space-y-6 bg-[var(--color-surface)] p-6 sm:p-8">
            <ul className="space-y-2 text-sm">
              {events.map((event) => (
                <li
                  key={event.key}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 py-2.5"
                >
                  <StatusMark status={event.status} />
                  <span className={event.status === "fail" ? "text-destructive" : ""}>
                    {event.label}
                    {event.message ? ` - ${event.message}` : ""}
                  </span>
                </li>
              ))}
              {events.length === 0 && (
                <li className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text-secondary)]">
                  Starting...
                </li>
              )}
            </ul>

            {deployedLinks.length > 0 && (
              <div className="space-y-3">
                <SectionLabel>Draft pages</SectionLabel>
                <ul className="space-y-1 text-sm">
                  {deployedLinks.map((link) => (
                    <li key={link.wpPageId} className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{link.title}</span>
                      <a
                        href={link.editUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-[var(--color-border-default)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary-hover)]"
                      >
                        Edit in WP
                      </a>
                      <a
                        href={link.viewUrl}
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
                    setFinished(null);
                    setStep(3);
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

  return (
    <div className={embedded ? "drawer-build-workspace" : "page-body"}>
      {!embedded ? (
        <PageHead
          title="Landing Page Build"
          subline="Create Google Ads landing pages from one Build Package JSON file."
          clientName={name || buildPackage?.client || "Untitled client"}
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
      ) : null}

      <div className="wizard-workspace-frame grid overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-sm lg:grid-cols-[248px_minmax(0,1fr)]">
        <StepperRail step={step} setStep={setStep} />
        <section className="overflow-hidden bg-[var(--color-surface)]">
          <PanelHead
            icon={STEP_DETAILS[step].icon}
            title={STEP_DETAILS[step].title}
            description={STEP_DETAILS[step].description}
          />
          <div key={step} className="wizard-step-enter space-y-7 bg-[var(--color-surface)] p-6 sm:p-8">
            {step === 0 && (
              <div className="space-y-6">
                <SectionLabel>Upload area</SectionLabel>
                <BuildPackageUpload onFile={handleBuildPackage} />
                {packageError && (
                  <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-primary-tint)] p-4 text-sm font-semibold text-[var(--color-primary)]">
                    {packageError}
                  </div>
                )}
                {buildPackage && (
                  <div className="space-y-5">
                    <SectionLabel>Detection summary</SectionLabel>
                    <PackageSummary
                      buildPackage={buildPackage}
                      packageFilename={packageFilename}
                    />
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <SectionLabel>Color palette</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["primary", "secondary"] as const).map((key) => (
                    <ColorField
                      key={key}
                      label={key}
                      value={colors[key]}
                      onChange={(value) => setColors({ ...colors, [key]: value })}
                    />
                  ))}
                </div>
                <p className="text-[12px] font-medium text-[var(--muted)]">
                  Black and white are permanent foundation variables, so they are
                  not shown here. Optional colors update semantic Atomic variables.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <OptionalColorField
                    label="accent"
                    hint="When unchecked, the accent slot reuses the secondary color."
                    checked={useAccent}
                    onCheckedChange={setUseAccent}
                    value={colors.accent}
                    onChange={(value) => setColors({ ...colors, accent: value })}
                  />
                  <OptionalColorField
                    label="highlight"
                    hint="Maps to the shared color-surface Atomic variable."
                    checked={useHighlight}
                    onCheckedChange={setUseHighlight}
                    value={highlight}
                    onChange={setHighlight}
                  />
                </div>
                <SectionLabel>Typography</SectionLabel>
                <div className="grid gap-4 md:grid-cols-2">
                  <FontSelect
                    label="Heading font"
                    value={fontHeading}
                    onChange={setFontHeading}
                  />
                  <FontSelect
                    label="Body font"
                    value={fontBody}
                    onChange={setFontBody}
                  />
                </div>
                <SectionLabel>Assets</SectionLabel>
                <div className="grid gap-4 md:grid-cols-2">
                  <AssetUpload
                    label="Logo"
                    hint="Required. PNG, JPG, or SVG. Max 2MB."
                    accept=".png,.jpg,.jpeg,.svg"
                    preview={logo?.previewUrl}
                    onFile={handleLogo}
                  />
                  <AssetUpload
                    label="Favicon"
                    hint="Required. PNG or ICO. Max 500KB."
                    accept=".png,.ico"
                    preview={favicon?.previewUrl}
                    onFile={handleFavicon}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <SectionLabel>WordPress destination</SectionLabel>
                <Field label="Practice name">
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!initialClient) setSlug(slugify(e.target.value));
                    }}
                  />
                </Field>
                <Field label="Slug">
                  <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
                </Field>
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
                      : "Stored encrypted. Never sent to the browser again."
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

            {step === 3 && buildPackage && (
              <div className="space-y-4 text-sm">
                <SectionLabel>Build summary</SectionLabel>
                <Review label="Practice" value={name} onEdit={() => setStep(2)} />
                <Review label="WP site" value={siteUrl} onEdit={() => setStep(2)} />
                <Review
                  label="Brand kit"
                  onEdit={() => setStep(1)}
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="flex gap-1">
                        {[
                          colors.primary,
                          colors.secondary,
                          ...(useAccent ? [colors.accent] : []),
                          ...(useHighlight ? [highlight] : []),
                        ].map((color) => (
                          <span
                            key={color}
                            className="inline-block h-4 w-4 rounded border"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </span>
                      <span>{fontHeading} / {fontBody}</span>
                    </span>
                  }
                />
                <Review label="Logo" value={logo ? logo.filename : "none"} onEdit={() => setStep(1)} />
                <Review label="Favicon" value={favicon ? favicon.filename : "none"} onEdit={() => setStep(1)} />
                <Review label="Content file" value={packageFilename} onEdit={() => setStep(0)} />
                <PackageSummary buildPackage={buildPackage} />
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
            {step < 3 ? (
              <Button onClick={next} disabled={step === 0 && !buildPackage}>
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
    </div>
  );
}

function BuildPackageUpload({
  onFile,
}: {
  onFile: (file: File) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);

  function loadFile(file: File | undefined) {
    if (!file) return;
    void Promise.resolve(onFile(file)).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Could not read file.");
    });
  }

  return (
    <label
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
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
      className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center shadow-xs transition ${
        dragging
          ? "border-[var(--color-primary)] bg-[var(--color-primary-tint)]"
          : "border-[var(--line-strong)] bg-[var(--paper-2)] hover:bg-[var(--card)]"
      }`}
    >
      <UploadCloud className="size-7 text-[var(--primary)]" />
      <span className="text-sm font-bold text-[var(--ink)]">Upload Build Package</span>
      <span className="max-w-md text-xs font-medium leading-5 text-[var(--muted)]">
        JSON file exported from the Landing Page Brief Processor in Claude
      </span>
      <span className="text-xs font-medium text-[var(--muted)]">
        Drag and drop or click to browse.
      </span>
      <input
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={(e) => {
          loadFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function PackageSummary({
  buildPackage,
  packageFilename,
}: {
  buildPackage: BuildPackage;
  packageFilename?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="table-block">
        <div className="grid-head grid-cols-3">
          <div>Page</div>
          <div>Template</div>
          <div>Slots found</div>
        </div>
        {buildPackage.pages.map((page) => (
          <div key={`${page.page_type}-${page.template}`} className="grid-row grid-cols-3">
            <div className="row-meta">{page.page_type}</div>
            <div>{TEMPLATE_LABELS[page.template]}</div>
            <div>{Object.keys(page.slots).length} slots</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm">
        {packageFilename && (
          <p className="font-medium text-[var(--muted)]">Loaded file: {packageFilename}</p>
        )}
        <p>
          Client name detected from the file:{" "}
          <strong className="font-bold">{buildPackage.client}</strong>
        </p>
        {!buildPackage.pages.some((page) => page.template === "thank_you") && (
          <p className="font-medium text-[var(--muted)]">
            No Thank You page in this file. One will be added automatically with
            default content and a link to the practice website.
          </p>
        )}
        <p className="font-medium text-[var(--muted)]">
          Review the pages above. If anything looks wrong, upload a corrected file.
        </p>
      </div>
    </div>
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

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <Label>{label}</Label>
      <Combobox
        items={GOOGLE_FONTS}
        value={value}
        onValueChange={onChange}
        placeholder="Select a font"
        searchPlaceholder="Search Google Fonts..."
        emptyMessage="No fonts found."
      />
    </div>
  );
}

function AssetUpload({
  label,
  hint,
  accept,
  preview,
  onFile,
}: {
  label: string;
  hint: string;
  accept: string;
  preview?: string;
  onFile: (file: File) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);

  function loadFile(file: File | undefined) {
    if (!file) return;
    void Promise.resolve(onFile(file)).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Could not read file.");
    });
  }

  return (
    <label
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
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
      className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-5 text-center transition ${
        dragging
          ? "border-[var(--color-primary)] bg-[var(--color-primary-tint)]"
          : "border-[var(--line-strong)] bg-[var(--paper-2)] hover:bg-[var(--card)]"
      }`}
    >
      <UploadCloud className="size-6 text-[var(--primary)]" />
      <span className="text-sm font-semibold text-[var(--ink)]">
        {preview ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </span>
      <span className="text-xs font-medium text-[var(--muted)]">{hint}</span>
      <span className="text-xs font-medium text-[var(--muted)]">
        Drag and drop or click to browse.
      </span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          loadFile(e.target.files?.[0]);
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
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 border border-[var(--line)] bg-[var(--paper-2)] p-3">
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

function OptionalColorField({
  label,
  hint,
  checked,
  onCheckedChange,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3 border border-[var(--line)] bg-[var(--paper-2)] p-3">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="size-4 shrink-0 cursor-pointer accent-[var(--color-primary)]"
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">
          Use {label} color
        </span>
      </label>
      {checked ? (
        <ColorField label={label} value={value} onChange={onChange} />
      ) : (
        <p className="text-[12px] font-medium text-[var(--muted)]">{hint}</p>
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
  children,
}: {
  title: string;
  subline: string;
  clientName: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-banner">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{subline}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-pill bg-[var(--color-primary-tint)] px-3.5 py-2 text-xs font-semibold text-[var(--color-primary-hover)]">
          Landing Page
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
                  <span className={`block text-[13px] font-semibold leading-tight tracking-[-0.01em] ${active ? "text-[var(--color-primary-hover)]" : "text-[var(--color-text-primary)]"}`}>
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
            className="h-full rounded-pill bg-[var(--color-primary)] transition-[width] duration-200 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-xs font-medium text-[var(--color-text-faint)]">
          {percent}% complete
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

function StatusMark({ status }: { status: StepEvent["status"] }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border text-xs font-bold ${
        status === "ok"
          ? "border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-on-primary)]"
          : status === "fail"
            ? "border-[var(--color-danger)] bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
            : "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-faint)]"
      }`}
    >
      {status === "ok" ? <Check className="size-3.5" /> : status === "fail" ? "x" : "..."}
    </span>
  );
}
