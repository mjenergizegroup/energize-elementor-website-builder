"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GOOGLE_FONTS } from "@/lib/google-fonts";
import type { BrandKit, UploadedAsset } from "@/lib/types";
import type { PageContent } from "@/lib/injection/types";

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

// A page detected by the parser, with selection + editable title/slug.
interface DetectedPage extends PageContent {
  selected: boolean;
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

const STEPS = [
  "Theme",
  "Practice Info",
  "Brand Kit",
  "WP Target",
  "Content",
  "Review",
] as const;

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
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function BuildWizard({
  themes,
  initialClient,
}: {
  themes: ThemeSummary[];
  initialClient?: InitialClient;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

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
  const [logo, setLogo] = useState<Asset | null>(null);
  const [favicon, setFavicon] = useState<Asset | null>(null);

  const [siteUrl, setSiteUrl] = useState(initialClient?.wpSiteUrl ?? "");
  const [username, setUsername] = useState(initialClient?.wpUsername ?? "");
  const [appPassword, setAppPassword] = useState("");

  const [markdownName, setMarkdownName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [practiceMeta, setPracticeMeta] = useState<{
    practiceName: string;
    city?: string;
    doctorName?: string;
  } | null>(null);
  const [detectedPages, setDetectedPages] = useState<DetectedPage[]>([]);

  const selectedTheme = themes.find((t) => t.key === theme);

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
      const content = json.content as {
        practiceName: string;
        city?: string;
        doctorName?: string;
        pages: PageContent[];
      };
      setPracticeMeta({
        practiceName: content.practiceName,
        city: content.city,
        doctorName: content.doctorName,
      });
      setDetectedPages(content.pages.map((p) => ({ ...p, selected: true })));
      toast.success(`Detected ${content.pages.length} pages.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse the markdown.");
    } finally {
      setParsing(false);
    }
  }

  function validateStep(current: number): string | null {
    switch (current) {
      case 0:
        if (!theme) return "Choose a theme.";
        if (selectedTheme && !selectedTheme.ready)
          return `The ${selectedTheme.label} theme is not ready yet (${selectedTheme.status}).`;
        return null;
      case 1:
        if (!name.trim()) return "Practice name is required.";
        if (!slug.trim()) return "Slug is required.";
        return null;
      case 3:
        if (!siteUrl.trim()) return "WordPress site URL is required.";
        if (!username.trim()) return "WordPress username is required.";
        if (!initialClient && !appPassword.trim())
          return "Application password is required for a new client.";
        return null;
      case 4:
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
    if (logo) kit.logo = { filename: logo.filename, dataBase64: logo.dataBase64 };
    if (favicon)
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
    const error = validateStep(4);
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

    // Build the content payload from the selected detected pages.
    const pages = detectedPages
      .filter((p) => p.selected)
      .map((p) => ({
        page: p.page,
        wpTitle: p.wpTitle,
        slug: p.slug,
        slots: p.slots,
        buildNotes: p.buildNotes,
      }));
    const content = {
      practiceName: practiceMeta?.practiceName ?? name,
      city: practiceMeta?.city,
      doctorName: practiceMeta?.doctorName,
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

  // ---- Deploy / success view ----
  if (deploying || finished) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">
          {finished === "success"
            ? "Deploy complete"
            : finished === "partial"
              ? "Deploy finished with issues"
              : finished === "failed"
                ? "Deploy failed"
                : "Deploying"}
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {events.map((e) => (
                <li key={e.key} className="flex items-center gap-2">
                  <span aria-hidden>
                    {e.status === "ok" ? "✓" : e.status === "fail" ? "✗" : "…"}
                  </span>
                  <span
                    className={
                      e.status === "fail" ? "text-destructive" : undefined
                    }
                  >
                    {e.label}
                    {e.message ? ` - ${e.message}` : ""}
                  </span>
                </li>
              ))}
              {events.length === 0 && (
                <li className="text-muted-foreground">Starting…</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {deployedLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Draft pages</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {deployedLinks.map((l) => (
                  <li key={l.wpPageId} className="flex items-center gap-3">
                    <span className="font-medium">{l.title}</span>
                    <a
                      href={l.editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      Edit in WP
                    </a>
                    <a
                      href={l.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      Preview
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {(buildNotes.length > 0 || warnings.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Build notes for David&apos;s team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {buildNotes.map((n, i) => (
                <p key={`note-${i}`}>{n}</p>
              ))}
              {warnings.map((w, i) => (
                <p key={`warn-${i}`} className="text-muted-foreground">
                  {w}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {finished && (
          <div className="flex gap-3">
            <Button onClick={() => router.push("/dashboard")}>
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
      </div>
    );
  }

  // ---- Wizard steps ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Build</h1>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`rounded px-2 py-1 ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-muted"
                    : "text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {step === 0 && (
            <div className="space-y-4">
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
                <p className="text-sm text-muted-foreground">
                  Pages: {selectedTheme.pages.map((p) => p.label).join(", ") || "none"}
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
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
              <div className="space-y-2">
                <Label>Doctors</Label>
                {doctors.map((doc, i) => (
                  <div key={i} className="space-y-2 rounded border p-3">
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
              <Field label="Services" hint="One per line.">
                <Textarea value={services} onChange={(e) => setServices(e.target.value)} rows={4} />
              </Field>
              <Field label="Social URLs" hint="One per line.">
                <Textarea value={social} onChange={(e) => setSocial(e.target.value)} rows={3} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <FontSelect label="Heading font" value={fontHeading} onChange={setFontHeading} />
                <FontSelect label="Body font" value={fontBody} onChange={setFontBody} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <FileField
                  label="Logo"
                  hint="PNG, JPG, or SVG. Max 2MB."
                  accept=".png,.jpg,.jpeg,.svg"
                  preview={logo?.previewUrl}
                  onFile={handleLogo}
                />
                <FileField
                  label="Favicon"
                  hint="PNG or ICO. Max 500KB."
                  accept=".png,.ico"
                  preview={favicon?.previewUrl}
                  onFile={handleFavicon}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
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

          {step === 4 && (
            <div className="space-y-4">
              <FileField
                label="Approved content markdown"
                hint="Output from the dental-content-writer skill. Max 1MB."
                accept=".md,.markdown,.txt"
                onFile={handleMarkdown}
              />
              {parsing && (
                <p className="text-sm text-muted-foreground">Parsing {markdownName}...</p>
              )}
              {!parsing && practiceMeta && (
                <p className="text-sm text-muted-foreground">
                  Parsed {markdownName}: {practiceMeta.practiceName}
                  {practiceMeta.doctorName ? ` · ${practiceMeta.doctorName}` : ""}
                  {practiceMeta.city ? ` · ${practiceMeta.city}` : ""}
                </p>
              )}
              {detectedPages.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Detected pages to build</Label>
                    {detectedPages.map((p, i) => {
                      const slotCount = Object.keys(p.slots).length;
                      return (
                        <div key={`${p.page}-${i}`} className="space-y-2 rounded border p-3">
                          <label className="flex items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              checked={p.selected}
                              onChange={(e) => updatePage(i, { selected: e.target.checked })}
                            />
                            {p.page}
                            <span className="text-xs font-normal text-muted-foreground">
                              {slotCount} fields
                              {p.buildNotes && p.buildNotes.length > 0
                                ? ` · ${p.buildNotes.length} flags`
                                : ""}
                            </span>
                          </label>
                          {p.selected && (
                            <div className="grid grid-cols-2 gap-2">
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

          {step === 5 && (
            <div className="space-y-4 text-sm">
              <Review label="Theme" value={selectedTheme?.label ?? theme} />
              <Review label="Practice" value={`${name} (${slug})`} />
              <Review label="WP site" value={siteUrl} />
              <Review
                label="Brand colors"
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
              <Review label="Fonts" value={`${fontHeading} / ${fontBody}`} />
              <Review label="Logo" value={logo ? logo.filename : "none"} />
              <Review label="Favicon" value={favicon ? favicon.filename : "none"} />
              <Review label="Content" value={markdownName || "none"} />
              <Review
                label="Pages"
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
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={deploy}>Deploy</Button>
        )}
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
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
    <div className="space-y-2">
      <Label className="capitalize">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border"
          aria-label={`${label} color picker`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
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
    <div className="space-y-2">
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
  onFile: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={`${label} preview`} className="mt-2 h-16 w-auto rounded border" />
      )}
    </div>
  );
}

function Review({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
