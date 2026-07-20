import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Check, Settings2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LayoutThumbnail } from "@/components/layout-thumbnail";
import { getLayoutTemplate } from "@/lib/layouts/repository";
import type { LayoutSanitationReport, LayoutThumbnail as LayoutThumbnailData } from "@/lib/layouts/types";
import type { TemplateAnalysis } from "@/lib/template-import/types";

export const dynamic = "force-dynamic";

function jsonObject<T>(value: unknown): T | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : undefined;
}

export default async function TemplateSetupPage({
  params,
}: {
  params: Promise<{ layoutId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();
  const { layoutId } = await params;
  const layout = await getLayoutTemplate(userId, layoutId).catch(() => null);
  if (!layout || !layout.activeRevision) notFound();

  const revision = layout.activeRevision;
  const analysis = jsonObject<TemplateAnalysis>(revision.technicalFindings);
  const report = jsonObject<LayoutSanitationReport>(revision.sanitationReport);
  const thumbnail = jsonObject<LayoutThumbnailData>(layout.thumbnail) ?? {
    sectionCount: 0,
    headingSlots: 0,
    bodySlots: 0,
    imageSlots: 0,
    buttonSlots: 0,
  };

  return (
    <main className="page-body">
      <section className="page-banner">
        <div>
          <div className="eyebrow">Template setup</div>
          <h1 className="page-title">{layout.friendlyName}</h1>
          <p className="page-copy">
            Technical checks are kept here so website builders only see layouts that are ready.
          </p>
        </div>
        <Link href="/dashboard/templates" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft data-icon="inline-start" /> Back to library
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 shadow-sm">
          <LayoutThumbnail data={thumbnail} className="aspect-[1.28/1]" />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Badge variant={layout.status === "ready" ? "default" : "destructive"}>
              {layout.status === "ready" ? "Ready" : "Needs setup"}
            </Badge>
            <span className="text-xs text-[var(--color-text-secondary)]">Revision {revision.version}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{layout.structuralSummary}</p>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] shadow-sm">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 text-[var(--color-text-primary)]">
            {layout.status === "ready" ? <Check className="size-5" /> : <Settings2 className="size-5" />}
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {layout.status === "ready" ? "Safe and ready" : "Setup required"}
            </h2>
          </div>

          <div className="space-y-6 p-6">
            {report?.blockingReasons && report.blockingReasons.length > 0 ? (
              <div>
                <h3 className="text-base font-semibold tracking-[-0.01em]">What needs attention</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {report.blockingReasons.map((reason) => (
                    <li key={reason} className="rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-[var(--color-danger)]">{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-semibold tracking-[-0.01em]">Sanitation passed</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Source content, links, media, IDs, globals, dynamic bindings, and custom code were removed before this layout was saved.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <TechnicalStat label="Source nodes" value={report?.sourceNodes ?? 0} />
              <TechnicalStat label="Safe nodes" value={report?.sanitizedNodes ?? 0} />
              <TechnicalStat label="Content removed" value={report?.contentValuesRemoved ?? 0} />
              <TechnicalStat label="Media removed" value={report?.sourceMediaRemoved ?? 0} />
              <TechnicalStat label="Links removed" value={report?.sourceLinksRemoved ?? 0} />
              <TechnicalStat label="Fresh IDs" value={report?.regeneratedIds ?? 0} />
            </div>

            {report?.unsupportedWidgetsRemoved && report.unsupportedWidgetsRemoved.length > 0 && (
              <details className="rounded-lg border border-[var(--color-border-default)] p-4">
                <summary className="cursor-pointer text-sm font-bold">
                  Removed unsupported regions ({report.unsupportedWidgetsRemoved.length})
                </summary>
                <ul className="mt-3 space-y-1 font-mono text-xs text-[var(--color-text-secondary)]">
                  {report.unsupportedWidgetsRemoved.map((widget) => <li key={widget}>{widget}</li>)}
                </ul>
              </details>
            )}

            <details className="rounded-lg border border-[var(--color-border-default)] p-4">
              <summary className="cursor-pointer text-sm font-bold">Source audit details</summary>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <AuditValue label="Internal source file" value={revision.originalFilename} />
                <AuditValue label="Source format" value={analysis?.format.label ?? "Unknown"} />
                <AuditValue label="Analyzer" value={revision.analyzerVersion} />
                <AuditValue label="Sanitizer" value={revision.sanitizerVersion} />
                <AuditValue label="Source domains found" value={String(analysis?.dependencies.externalHosts.length ?? 0)} />
                <AuditValue label="Residue matches" value={String(report?.residueMatches.length ?? 0)} />
              </dl>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}

function TechnicalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface)] p-4">
      <div className="text-2xl font-semibold tracking-[-0.03em]">{value}</div>
      <div className="mt-1 text-xs font-medium text-[var(--color-text-faint)]">{label}</div>
    </div>
  );
}

function AuditValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
