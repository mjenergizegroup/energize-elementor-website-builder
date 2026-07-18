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
          <h1 className="page-title">{layout.friendlyName}.</h1>
          <p className="page-copy">
            Technical checks are kept here so website builders only see layouts that are ready.
          </p>
        </div>
        <Link href="/dashboard/templates" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft data-icon="inline-start" /> Back to library
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="border-2 border-[var(--color-black)] bg-white p-5">
          <LayoutThumbnail data={thumbnail} className="aspect-[1.28/1]" />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Badge variant={layout.status === "ready" ? "default" : "destructive"}>
              {layout.status === "ready" ? "Ready" : "Needs setup"}
            </Badge>
            <span className="text-xs text-[var(--color-muted)]">Revision {revision.version}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{layout.structuralSummary}</p>
        </section>

        <section className="overflow-hidden border-2 border-[var(--color-black)] bg-white">
          <div className="flex items-center gap-3 bg-[var(--color-black)] p-4 text-white">
            {layout.status === "ready" ? <Check className="size-5" /> : <Settings2 className="size-5" />}
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
              {layout.status === "ready" ? "Safe and ready" : "Setup required"}
            </h2>
          </div>

          <div className="space-y-6 p-6">
            {report?.blockingReasons && report.blockingReasons.length > 0 ? (
              <div>
                <h3 className="text-base font-black tracking-[-0.02em]">What needs attention</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
                  {report.blockingReasons.map((reason) => (
                    <li key={reason} className="border-l-2 border-[var(--color-red)] pl-3">{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-black tracking-[-0.02em]">Sanitation passed</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
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
              <details className="border-2 border-[var(--color-black)] p-4">
                <summary className="cursor-pointer text-sm font-bold">
                  Removed unsupported regions ({report.unsupportedWidgetsRemoved.length})
                </summary>
                <ul className="mt-3 space-y-1 font-mono text-xs text-[var(--color-muted)]">
                  {report.unsupportedWidgetsRemoved.map((widget) => <li key={widget}>{widget}</li>)}
                </ul>
              </details>
            )}

            <details className="border-2 border-[var(--color-black)] p-4">
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
    <div className="border border-[var(--color-hairline)] bg-[var(--color-panel)] p-4">
      <div className="text-2xl font-black tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function AuditValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold uppercase tracking-[0.08em] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
