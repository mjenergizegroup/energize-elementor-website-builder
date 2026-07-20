"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileJson,
  LoaderCircle,
  PackageCheck,
  Plus,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { MotionCheckbox } from "@/components/motion/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import {
  TEMPLATE_PAGE_ROLES,
  type TemplateCompileBundle,
  type TemplateAnalysis,
  type TemplateMappingManifest,
  type TemplateMappingSelection,
  type TemplatePageRole,
  type TemplateWarning,
} from "@/lib/template-import/types";
import { cn } from "@/lib/utils";

export function TemplateImporter({
  initialBundle,
  onCompileChange,
  onManifestChange,
}: {
  initialBundle?: TemplateCompileBundle;
  onCompileChange?: (bundle: TemplateCompileBundle | null) => void;
  onManifestChange?: (manifest: TemplateMappingManifest | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const filesByChecksumRef = useRef<Map<string, File>>(new Map());
  const reduceMotion = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [analyses, setAnalyses] = useState<TemplateAnalysis[]>([]);
  const [mappings, setMappings] = useState<TemplateMappingSelection[]>([]);
  const [compileBundle, setCompileBundle] =
    useState<TemplateCompileBundle | null>(initialBundle ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const manifest = useMemo<TemplateMappingManifest | null>(() => {
    if (mappings.length === 0) return null;
    return {
      schemaVersion: "1",
      createdAt: new Date().toISOString(),
      mappings,
    };
  }, [mappings]);

  useEffect(() => {
    onManifestChange?.(manifest);
  }, [manifest, onManifestChange]);

  useEffect(() => {
    onCompileChange?.(compileBundle);
  }, [compileBundle, onCompileChange]);

  const selectable = mappings.filter((item) => item.status !== "blocked");
  const selectedCount = selectable.filter((item) => item.selected).length;
  const reviewCount = analyses.filter((item) => item.status === "review").length;
  const blockedCount = analyses.filter((item) => item.status === "blocked").length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;
  const partiallySelected = selectedCount > 0 && !allSelected;
  const busy = analyzing || compiling;

  async function analyzeFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (files.length > 20) {
      toast.error("Upload no more than 20 JSON files per batch.");
      return;
    }

    const formData = new FormData();
    for (const file of files) formData.append("files", file);

    setAnalyzing(true);
    try {
      const response = await fetch("/api/template-import/analyze", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        analyses?: TemplateAnalysis[];
        error?: string;
      };
      if (!response.ok || !payload.analyses) {
        throw new Error(payload.error ?? "Template analysis failed.");
      }

      payload.analyses.forEach((analysis, index) => {
        const file = files[index];
        if (file && !filesByChecksumRef.current.has(analysis.file.checksum)) {
          filesByChecksumRef.current.set(analysis.file.checksum, file);
        }
      });

      setAnalyses((previous) => mergeAnalyses(previous, payload.analyses!));
      setMappings((previous) =>
        mergeMappings(
          previous,
          payload.analyses!.map(toMapping),
        ),
      );
      setCompileBundle(null);
      toast.success(
        `${payload.analyses.length} JSON ${payload.analyses.length === 1 ? "file" : "files"} analyzed.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template analysis failed.");
    } finally {
      setAnalyzing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updateMapping(analysisId: string, patch: Partial<TemplateMappingSelection>) {
    setCompileBundle(null);
    setMappings((previous) =>
      previous.map((item) =>
        item.analysisId === analysisId ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeAnalysis(analysisId: string) {
    const analysis = analyses.find((item) => item.id === analysisId);
    if (analysis) filesByChecksumRef.current.delete(analysis.file.checksum);
    setCompileBundle(null);
    setAnalyses((previous) => previous.filter((item) => item.id !== analysisId));
    setMappings((previous) => previous.filter((item) => item.analysisId !== analysisId));
    setExpanded((previous) => {
      const next = new Set(previous);
      next.delete(analysisId);
      return next;
    });
  }

  function toggleExpanded(analysisId: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(analysisId)) next.delete(analysisId);
      else next.add(analysisId);
      return next;
    });
  }

  function toggleAll(nextSelected: boolean) {
    setCompileBundle(null);
    setMappings((previous) =>
      previous.map((item) =>
        item.status === "blocked" ? item : { ...item, selected: nextSelected },
      ),
    );
  }

  function exportManifest() {
    if (!manifest) return;
    downloadJson("energize-template-mapping.json", manifest);
    toast.success("Template mapping exported.");
  }

  async function compileSelected() {
    if (!manifest) return;
    const selectedMappings = manifest.mappings.filter((item) => item.selected);
    if (selectedMappings.length === 0) {
      toast.error("Select at least one template to compile.");
      return;
    }

    const selectedFiles = selectedMappings.map((mapping) =>
      filesByChecksumRef.current.get(mapping.checksum),
    );
    if (selectedFiles.some((file) => !file)) {
      toast.error("One or more source files are missing. Add the batch again before compiling.");
      return;
    }

    const formData = new FormData();
    formData.append("manifest", JSON.stringify(manifest));
    for (const file of selectedFiles) formData.append("files", file!);

    setCompiling(true);
    try {
      const response = await fetch("/api/template-import/compile", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as TemplateCompileBundle & {
        error?: string;
      };
      if (!response.ok || payload.schemaVersion !== "1") {
        throw new Error(payload.error ?? "Template compilation failed.");
      }
      setCompileBundle(payload);
      toast.success(
        `${payload.totals.compiled} portable ${payload.totals.compiled === 1 ? "artifact" : "artifacts"} compiled.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template compilation failed.");
    } finally {
      setCompiling(false);
    }
  }

  function exportCompileBundle() {
    if (!compileBundle) return;
    downloadJson("energize-template-compile-bundle.json", compileBundle);
    toast.success("Portable compile bundle exported.");
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".json,application/json"
        multiple
        disabled={busy}
        className="sr-only"
        onChange={(event) => void analyzeFiles(event.target.files ?? [])}
      />

      <motion.div
        layout
        transition={reduceMotion ? { duration: 0 } : SPRING_LAYOUT}
        role="button"
        tabIndex={0}
        aria-busy={busy}
        aria-label="Upload Elementor or other JSON template files"
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !busy) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void analyzeFiles(event.dataTransfer.files);
        }}
        animate={
          reduceMotion
            ? undefined
            : { scale: dragging ? 1.008 : 1, backgroundColor: dragging ? "var(--color-primary-tint)" : "var(--color-surface-raised)" }
        }
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-stretch justify-between gap-6 rounded-lg border border-dashed p-6 shadow-xs outline-none sm:flex-row sm:items-center",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
          dragging
            ? "border-[var(--color-primary)] bg-[var(--color-primary-tint)]"
            : "border-[var(--color-border-default)] bg-[var(--color-surface-raised)]",
          busy && "cursor-wait",
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          <motion.div
            animate={
              analyzing && !reduceMotion
                ? { rotate: 360 }
                : dragging && !reduceMotion
                  ? { y: -4 }
                  : { rotate: 0, y: 0 }
            }
            transition={
              analyzing
                ? { repeat: Infinity, duration: 1, ease: "linear" }
                : { duration: 0.2, ease: EASE_OUT }
            }
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]"
          >
            {analyzing ? <LoaderCircle className="size-5" /> : <UploadCloud className="size-5" />}
          </motion.div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[var(--color-text-primary)]">
              {analyzing ? "Analyzing template batch" : "Drop JSON templates here"}
            </p>
            <p className="mt-1 text-[12px] font-medium text-[var(--color-text-secondary)]">
              Up to 20 files, 2 MB each. Raw JSON is analyzed on the server and is not deployed.
            </p>
          </div>
        </div>
        {!busy && (
          <span className="hidden items-center gap-2 text-sm font-semibold text-[var(--color-primary-hover)] sm:flex">
            <Plus className="size-4" />
            Choose files
          </span>
        )}
      </motion.div>

      {analyses.length === 0 && compileBundle ? (
        <div className="space-y-3">
          <div className="border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm leading-6 text-[var(--ink)]">
            This project has a saved portable template bundle. Add the JSON files again only if you want to replace or edit its template mappings.
          </div>
          <CompileSummary
            bundle={compileBundle}
            reduceMotion={Boolean(reduceMotion)}
            onExport={exportCompileBundle}
          />
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {analyses.length > 0 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
            className="space-y-4"
          >
            <div className="grid overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] shadow-xs sm:grid-cols-4">
              <Metric label="Files analyzed" value={analyses.length} />
              <Metric label="Pages included" value={selectedCount} />
              <Metric label="Need review" value={reviewCount} />
              <Metric label="Blocked" value={blockedCount} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] p-3">
              <MotionCheckbox
                checked={allSelected}
                indeterminate={partiallySelected}
                onCheckedChange={toggleAll}
                disabled={busy}
                label={`${selectedCount} of ${selectable.length} templates included`}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  <Plus />
                  Add files
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportManifest} disabled={!manifest}>
                  <Download />
                  Export mapping
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void compileSelected()}
                  disabled={!manifest || selectedCount === 0 || compiling}
                >
                  {compiling ? <LoaderCircle className="animate-spin" /> : <PackageCheck />}
                  {compiling ? "Compiling" : "Compile selected"}
                </Button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {compileBundle ? (
                <CompileSummary
                  bundle={compileBundle}
                  reduceMotion={Boolean(reduceMotion)}
                  onExport={exportCompileBundle}
                />
              ) : null}
            </AnimatePresence>

            <motion.div layout className="space-y-3">
              <AnimatePresence initial={false}>
                {analyses.map((analysis, index) => {
                  const mapping = mappings.find((item) => item.analysisId === analysis.id);
                  if (!mapping) return null;
                  const isExpanded = expanded.has(analysis.id);

                  return (
                    <motion.article
                      layout
                      key={analysis.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { ...SPRING_LAYOUT, delay: Math.min(index * 0.035, 0.2) }
                      }
                      className={cn(
                        "rounded-lg border bg-[var(--color-surface-raised)] shadow-xs",
                        analysis.status === "blocked"
                          ? "border-[var(--color-danger)]"
                          : "border-[var(--color-border-default)]",
                      )}
                    >
                      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(170px,0.7fr)_minmax(150px,0.7fr)_auto] lg:items-start">
                        <div className="flex min-w-0 gap-3">
                          <MotionCheckbox
                            checked={mapping.selected}
                            disabled={analysis.status === "blocked" || compiling}
                            onCheckedChange={(selected) => updateMapping(analysis.id, { selected })}
                            aria-label={`Include ${analysis.file.name}`}
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <FileJson className="size-4 shrink-0 text-[var(--color-primary)]" />
                              <h3 className="truncate text-[14px] font-bold tracking-[-0.01em]">
                                {analysis.file.name}
                              </h3>
                              <StatusBadge status={analysis.status} />
                            </div>
                            <p className="mt-2 text-[11px] font-medium leading-5 text-[var(--color-text-secondary)]">
                              {analysis.format.label}
                              {analysis.format.exportVersion
                                ? ` v${analysis.format.exportVersion}`
                                : ""}
                              {` · ${analysis.structure.nodeCount} nodes · ${Object.keys(analysis.structure.widgets).length} widget types · ${formatBytes(analysis.file.sizeBytes)}`}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                            Page role
                          </label>
                          <Select
                            value={mapping.role}
                            onValueChange={(value) =>
                              value &&
                              updateMapping(analysis.id, {
                                role: value as TemplatePageRole,
                              })
                            }
                            disabled={analysis.status === "blocked" || compiling}
                          >
                            <SelectTrigger size="sm">
                              <SelectValue placeholder="Select page role" />
                            </SelectTrigger>
                            <SelectContent>
                              {TEMPLATE_PAGE_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                            {Math.round(analysis.suggestedPage.confidence * 100)}% suggestion confidence
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <Input
                            value={mapping.title}
                            onChange={(event) => updateMapping(analysis.id, { title: event.target.value })}
                            placeholder="WordPress title"
                            disabled={analysis.status === "blocked" || compiling}
                            className="h-9 text-[12px]"
                            aria-label={`WordPress title for ${analysis.file.name}`}
                          />
                          <Input
                            value={mapping.slug}
                            onChange={(event) =>
                              updateMapping(analysis.id, { slug: slugify(event.target.value) })
                            }
                            placeholder="page-slug"
                            disabled={analysis.status === "blocked" || compiling}
                            className="h-9 font-mono text-[11px]"
                            aria-label={`WordPress slug for ${analysis.file.name}`}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleExpanded(analysis.id)}
                            aria-label={`${isExpanded ? "Hide" : "Show"} analysis for ${analysis.file.name}`}
                            aria-expanded={isExpanded}
                          >
                            <motion.span
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
                            >
                              <ChevronDown className="size-4" />
                            </motion.span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeAnalysis(analysis.id)}
                            disabled={compiling}
                            aria-label={`Remove ${analysis.file.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {isExpanded ? (
                          <motion.div
                            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: EASE_OUT }}
                            className="overflow-hidden"
                          >
                            <AnalysisDetails analysis={analysis} />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CompileSummary({
  bundle,
  onExport,
  reduceMotion,
}: {
  bundle: TemplateCompileBundle;
  onExport: () => void;
  reduceMotion: boolean;
}) {
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
      className="overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-sm"
      aria-label="Portable compile result"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 text-[var(--color-text-primary)]">
        <div className="flex items-center gap-3">
          <PackageCheck className="size-5 text-[var(--color-primary)]" />
          <div>
            <h3 className="text-[14px] font-bold">Portable compile result</h3>
            <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
              Nothing has been sent to WordPress.
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onExport}>
          <Download />
          Export bundle
        </Button>
      </div>

      <div className="grid border-b border-[var(--color-border-default)] sm:grid-cols-4">
        <CompileMetric label="Artifacts" value={bundle.totals.compiled} />
        <CompileMetric label="Ready" value={bundle.totals.ready} />
        <CompileMetric label="Need review" value={bundle.totals.review} />
        <CompileMetric label="Blocked" value={bundle.totals.blocked} />
      </div>

      <div className="divide-y divide-[var(--color-border-default)] bg-[var(--color-surface-raised)]">
        {bundle.pages.map((page) => (
          <div
            key={page.analysisId}
            className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[13px] font-bold">{page.mapping.title}</p>
                <StatusBadge status={page.status} />
              </div>
              <p className="mt-1 text-[10px] font-medium leading-5 text-[var(--color-text-secondary)]">
                {page.compiler.id} · {page.transformations.elementIdsRegenerated} IDs regenerated · {page.transformations.mediaIdsCleared} media IDs cleared
              </p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              {page.targetKind === "wp-page" ? "WordPress page" : "Theme Builder template"}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function CompileMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--color-border-default)] p-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <span className="text-lg font-semibold">{value}</span>
      <span className="ml-2 text-xs font-medium text-[var(--color-text-faint)]">
        {label}
      </span>
    </div>
  );
}

function AnalysisDetails({ analysis }: { analysis: TemplateAnalysis }) {
  return (
    <div className="grid gap-5 border-t border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 lg:grid-cols-3">
      <div>
        <DetailLabel>Detected dependencies</DetailLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {analysis.dependencies.plugins.length > 0 ? (
            analysis.dependencies.plugins.map((plugin) => (
              <Badge key={plugin} variant="outline">
                {plugin}
              </Badge>
            ))
          ) : (
            <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">No extra plugins detected</span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
          <Stat label="Media URLs" value={analysis.dependencies.nonEmptyUrlObjects} />
          <Stat label="Source media IDs" value={analysis.dependencies.targetBoundMediaIds} />
          <Stat label="Global references" value={analysis.dependencies.globalReferences} />
          <Stat label="Dynamic bindings" value={analysis.dependencies.dynamicBindings} />
        </dl>
      </div>

      <div>
        <DetailLabel>External hosts</DetailLabel>
        {analysis.dependencies.externalHosts.length > 0 ? (
          <ul className="mt-2 space-y-1 font-mono text-[10px] leading-5 text-[var(--color-text-primary)]">
            {analysis.dependencies.externalHosts.slice(0, 8).map((host) => (
              <li key={host} className="truncate">
                {host}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-text-secondary)]">No external hosts detected</p>
        )}
      </div>

      <div>
        <DetailLabel>Review findings</DetailLabel>
        {analysis.warnings.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {analysis.warnings.map((item) => (
              <WarningItem key={item.code} warning={item} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-text-secondary)]">No compatibility warnings</p>
        )}
      </div>
    </div>
  );
}

function WarningItem({ warning }: { warning: TemplateWarning }) {
  const Icon = warning.severity === "blocker" ? ShieldAlert : AlertTriangle;
  return (
    <li className="flex gap-2 text-[11px] leading-5">
      <Icon
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          warning.severity === "blocker" ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]",
        )}
      />
      <div>
        <p className="font-bold">{warning.title}</p>
        <p className="font-medium text-[var(--color-text-secondary)]">{warning.message}</p>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[var(--color-border-default)] p-4 text-[var(--color-text-primary)] last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <AnimatedNumber value={value} className="block text-[26px] font-semibold leading-none tracking-[-0.03em]" />
      <span className="mt-2 block text-xs font-medium text-[var(--color-text-faint)]">
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: TemplateAnalysis["status"] }) {
  if (status === "blocked") return <Badge variant="destructive">Blocked</Badge>;
  if (status === "review") return <Badge variant="secondary">Review</Badge>;
  return <Badge>Ready</Badge>;
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[var(--color-text-faint)]">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-medium text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

function toMapping(analysis: TemplateAnalysis): TemplateMappingSelection {
  return {
    analysisId: analysis.id,
    fileName: analysis.file.name,
    checksum: analysis.file.checksum,
    selected: analysis.status !== "blocked",
    role: analysis.suggestedPage.role,
    title: analysis.suggestedPage.label,
    slug: analysis.suggestedPage.slug,
    status: analysis.status,
  };
}

function mergeAnalyses(previous: TemplateAnalysis[], incoming: TemplateAnalysis[]) {
  const next = new Map(previous.map((item) => [item.file.checksum, item]));
  for (const item of incoming) {
    if (!next.has(item.file.checksum)) next.set(item.file.checksum, item);
  }
  return [...next.values()];
}

function mergeMappings(
  previous: TemplateMappingSelection[],
  incoming: TemplateMappingSelection[],
) {
  const next = new Map(previous.map((item) => [item.checksum, item]));
  for (const item of incoming) {
    if (!next.has(item.checksum)) next.set(item.checksum, item);
  }
  return [...next.values()];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
