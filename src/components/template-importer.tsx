"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileJson,
  LoaderCircle,
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
  type TemplateAnalysis,
  type TemplateMappingManifest,
  type TemplateMappingSelection,
  type TemplatePageRole,
  type TemplateWarning,
} from "@/lib/template-import/types";
import { cn } from "@/lib/utils";

export function TemplateImporter({
  onManifestChange,
}: {
  onManifestChange?: (manifest: TemplateMappingManifest | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<TemplateAnalysis[]>([]);
  const [mappings, setMappings] = useState<TemplateMappingSelection[]>([]);
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

  const selectable = mappings.filter((item) => item.status !== "blocked");
  const selectedCount = selectable.filter((item) => item.selected).length;
  const reviewCount = analyses.filter((item) => item.status === "review").length;
  const blockedCount = analyses.filter((item) => item.status === "blocked").length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

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

      setAnalyses((previous) => mergeAnalyses(previous, payload.analyses!));
      setMappings((previous) =>
        mergeMappings(
          previous,
          payload.analyses!.map(toMapping),
        ),
      );
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
    setMappings((previous) =>
      previous.map((item) =>
        item.analysisId === analysisId ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeAnalysis(analysisId: string) {
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
    setMappings((previous) =>
      previous.map((item) =>
        item.status === "blocked" ? item : { ...item, selected: nextSelected },
      ),
    );
  }

  function exportManifest() {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "energize-template-mapping.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Template mapping exported.");
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".json,application/json"
        multiple
        className="sr-only"
        onChange={(event) => void analyzeFiles(event.target.files ?? [])}
      />

      <motion.div
        layout
        transition={reduceMotion ? { duration: 0 } : SPRING_LAYOUT}
        role="button"
        tabIndex={0}
        aria-label="Upload Elementor or other JSON template files"
        onClick={() => !analyzing && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !analyzing) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!analyzing) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!analyzing) void analyzeFiles(event.dataTransfer.files);
        }}
        animate={
          reduceMotion
            ? undefined
            : { scale: dragging ? 1.008 : 1, backgroundColor: dragging ? "#f9ecec" : "#ffffff" }
        }
        className={cn(
          "flex min-h-36 cursor-pointer items-center justify-between gap-6 border-2 border-dashed p-6 outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red)]",
          dragging
            ? "border-[var(--color-red)]"
            : "border-[var(--color-black)] bg-[var(--color-surface)]",
          analyzing && "cursor-wait",
        )}
      >
        <div className="flex items-center gap-4">
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
            className="flex size-12 shrink-0 items-center justify-center bg-[var(--color-black)] text-white"
          >
            {analyzing ? <LoaderCircle className="size-5" /> : <UploadCloud className="size-5" />}
          </motion.div>
          <div>
            <p className="text-[15px] font-bold text-[var(--color-black)]">
              {analyzing ? "Analyzing template batch" : "Drop JSON templates here"}
            </p>
            <p className="mt-1 text-[12px] font-medium text-[var(--color-muted)]">
              Up to 20 files, 2 MB each. Raw JSON is analyzed on the server and is not deployed.
            </p>
          </div>
        </div>
        {!analyzing && (
          <span className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-red)] sm:flex">
            <Plus className="size-4" />
            Choose files
          </span>
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {analyses.length > 0 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
            className="space-y-4"
          >
            <div className="grid border-2 border-[var(--color-black)] bg-[var(--color-black)] sm:grid-cols-4">
              <Metric label="Files analyzed" value={analyses.length} />
              <Metric label="Pages included" value={selectedCount} />
              <Metric label="Need review" value={reviewCount} />
              <Metric label="Blocked" value={blockedCount} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-black)] bg-[var(--color-panel)] p-3">
              <MotionCheckbox
                checked={allSelected}
                indeterminate={partiallySelected}
                onCheckedChange={toggleAll}
                label={`${selectedCount} of ${selectable.length} templates included`}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  <Plus />
                  Add files
                </Button>
                <Button type="button" size="sm" onClick={exportManifest} disabled={!manifest}>
                  <Download />
                  Export mapping
                </Button>
              </div>
            </div>

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
                        "border-2 bg-[var(--color-surface)]",
                        analysis.status === "blocked"
                          ? "border-[var(--color-red)]"
                          : "border-[var(--color-black)]",
                      )}
                    >
                      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(170px,0.7fr)_minmax(150px,0.7fr)_auto] lg:items-start">
                        <div className="flex min-w-0 gap-3">
                          <MotionCheckbox
                            checked={mapping.selected}
                            disabled={analysis.status === "blocked"}
                            onCheckedChange={(selected) => updateMapping(analysis.id, { selected })}
                            aria-label={`Include ${analysis.file.name}`}
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <FileJson className="size-4 shrink-0 text-[var(--color-red)]" />
                              <h3 className="truncate text-[14px] font-bold tracking-[-0.01em]">
                                {analysis.file.name}
                              </h3>
                              <StatusBadge status={analysis.status} />
                            </div>
                            <p className="mt-2 text-[11px] font-medium leading-5 text-[var(--color-muted)]">
                              {analysis.format.label}
                              {analysis.format.exportVersion
                                ? ` v${analysis.format.exportVersion}`
                                : ""}
                              {` · ${analysis.structure.nodeCount} nodes · ${Object.keys(analysis.structure.widgets).length} widget types · ${formatBytes(analysis.file.sizeBytes)}`}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
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
                            disabled={analysis.status === "blocked"}
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
                          <p className="text-[10px] font-medium text-[var(--color-muted)]">
                            {Math.round(analysis.suggestedPage.confidence * 100)}% suggestion confidence
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <Input
                            value={mapping.title}
                            onChange={(event) => updateMapping(analysis.id, { title: event.target.value })}
                            placeholder="WordPress title"
                            disabled={analysis.status === "blocked"}
                            className="h-9 text-[12px]"
                            aria-label={`WordPress title for ${analysis.file.name}`}
                          />
                          <Input
                            value={mapping.slug}
                            onChange={(event) =>
                              updateMapping(analysis.id, { slug: slugify(event.target.value) })
                            }
                            placeholder="page-slug"
                            disabled={analysis.status === "blocked"}
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

function AnalysisDetails({ analysis }: { analysis: TemplateAnalysis }) {
  return (
    <div className="grid gap-5 border-t-2 border-[var(--color-black)] bg-[var(--color-panel)] p-4 lg:grid-cols-3">
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
            <span className="text-[12px] font-medium text-[var(--color-muted)]">No extra plugins detected</span>
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
          <ul className="mt-2 space-y-1 font-mono text-[10px] leading-5 text-[var(--color-black)]">
            {analysis.dependencies.externalHosts.slice(0, 8).map((host) => (
              <li key={host} className="truncate">
                {host}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-muted)]">No external hosts detected</p>
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
          <p className="mt-2 text-[12px] font-medium text-[var(--color-muted)]">No compatibility warnings</p>
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
          warning.severity === "blocker" ? "text-[var(--color-red)]" : "text-[var(--color-black)]",
        )}
      />
      <div>
        <p className="font-bold">{warning.title}</p>
        <p className="font-medium text-[var(--color-muted)]">{warning.message}</p>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[#3a3a3a] p-4 text-white last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <AnimatedNumber value={value} className="block text-[26px] font-black leading-none tracking-[-0.04em]" />
      <span className="mt-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#9a9a9a]">
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
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-medium text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-black text-[var(--color-black)]">{value}</dd>
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
  for (const item of incoming) next.set(item.file.checksum, item);
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
