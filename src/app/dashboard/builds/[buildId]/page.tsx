import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, RotateCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type DeployedPage = {
  page: string;
  title?: string;
  wpPageId: number;
  editUrl: string;
  viewUrl?: string;
  status?: string;
  kind?: "content" | "accessibility-statement";
};

type AccessibilityIssue = {
  id: string;
  severity: "pass" | "warning" | "fail" | "manual";
  rule: string;
  page?: string;
  message: string;
  guidance?: string;
};

type AccessibilityReport = {
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
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not deployed";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: Date | string | null | undefined) {
  if (!value) return "Pending";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusVariant(status: string) {
  if (status === "success" || status === "pushed") return "default";
  if (status === "partial") return "warning";
  if (status === "in_progress") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function isLandingPageBuild(theme: string | null | undefined) {
  return theme === "landing-page";
}

function buildTypeLabel(landingPageBuild: boolean) {
  return landingPageBuild ? "Landing Page build" : "Website build";
}

function parseAccessibilityReport(errorLog: string | null): AccessibilityReport | null {
  if (!errorLog) return null;
  try {
    const parsed = JSON.parse(errorLog) as { accessibilityReport?: AccessibilityReport };
    return parsed.accessibilityReport ?? null;
  } catch {
    return null;
  }
}

export default async function BuildDetailPage({
  params,
}: {
  params: Promise<{ buildId: string }>;
}) {
  const { buildId } = await params;
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: {
      id: true,
      pagesDeployed: true,
      status: true,
      deployedAt: true,
      deployedBy: true,
      createdAt: true,
      errorLog: true,
      client: {
        select: {
          id: true,
          name: true,
          theme: true,
          wpSiteUrl: true,
        },
      },
    },
  });

  if (!build) notFound();

  const pages = (build.pagesDeployed ?? []) as DeployedPage[];
  const pushedCount = pages.filter((page) => page.editUrl).length;
  const landingPageBuild = isLandingPageBuild(build.client?.theme);
  const accessibilityReport = parseAccessibilityReport(build.errorLog);

  return (
    <main className="page-body">
      <section className="detail-head">
        <div className="min-w-0">
          <Link
            href="/dashboard/builds"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold leading-none text-[var(--color-text-secondary)] hover:text-[var(--color-primary-hover)]"
          >
            <ArrowLeft className="size-3" />
            All builds
          </Link>
          <h1 className="truncate text-3xl font-semibold leading-tight tracking-[-0.03em]">
            {build.client?.name ?? "Unknown client"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-text-secondary)]">
            <Badge variant={statusVariant(build.status)}>{build.status}</Badge>
            <span>{buildTypeLabel(landingPageBuild)}</span>
            <span>{landingPageBuild ? "Google Ads" : "Atomic website drafts"}</span>
            <span>{formatDate(build.deployedAt ?? build.createdAt)}</span>
            <span>Build ID: {build.id}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={
              build.client
                ? `/dashboard/new?type=${landingPageBuild ? "landing-page" : "new-website"}&clientId=${build.client.id}`
                : "/dashboard/new"
            }
            className={buttonVariants()}
          >
            <RotateCw data-icon="inline-start" />
            Rebuild
          </Link>
          <Link
            href="/dashboard/builds"
            className={buttonVariants({ variant: "outline" })}
          >
            <Download data-icon="inline-start" />
            Export JSON
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <section className="table-block">
            <div className="block-head">
              <h2>Pages pushed</h2>
              <span className="block-note">
                {pushedCount} of {pages.length} pushed
              </span>
            </div>
            <div className="grid-head pages-grid">
              <div>Page</div>
              <div>WordPress Draft Link</div>
              <div>Status</div>
              <div>Pushed at</div>
            </div>
            {pages.length === 0 ? (
              <p className="grid-row">No page records were saved for this build.</p>
            ) : (
              pages.map((page) => (
                <div key={`${page.wpPageId}-${page.page}`} className="grid-row pages-grid">
                  <div className="row-meta">{page.page}</div>
                  {page.editUrl ? (
                    <a
                      href={page.editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {page.editUrl}
                    </a>
                  ) : (
                    <span className="row-sub">No WordPress link</span>
                  )}
                  <div>
                    <Badge variant={statusVariant(page.status ?? "pushed")}>
                      {page.status ?? "pushed"}
                    </Badge>
                  </div>
                  <div className="row-sub">{formatTime(build.deployedAt)}</div>
                </div>
              ))
            )}
          </section>

          {accessibilityReport && (
            <section className="table-block">
              <div className="block-head">
                <h2>Accessibility QA</h2>
                <span className="block-note">
                  {accessibilityReport.launchReady
                    ? "No blocking issues"
                    : `${accessibilityReport.summary.fail} blocking issue(s)`}
                </span>
              </div>
              <div className="grid gap-3 p-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={accessibilityReport.launchReady ? "default" : "destructive"}>
                    {accessibilityReport.target}
                  </Badge>
                  <Badge variant="secondary">{accessibilityReport.summary.pass} pass</Badge>
                  <Badge variant="secondary">
                    {accessibilityReport.summary.warning} warnings
                  </Badge>
                  <Badge variant="destructive">{accessibilityReport.summary.fail} fail</Badge>
                  <Badge variant="outline">{accessibilityReport.summary.manual} manual</Badge>
                </div>
                {accessibilityReport.issues
                  .filter((issue) => issue.severity !== "pass")
                  .map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-md border border-[var(--line)] bg-[var(--paper-2)] p-4"
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
                        <p className="mt-1 text-[var(--muted)]">{issue.guidance}</p>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>

        <aside className="info-panel self-start">
          <div className="block-head">
            <h2>Build info</h2>
          </div>
          <div>
            <InfoRow label="Client" value={build.client?.name ?? "Unknown client"} />
            <InfoRow label="Build type" value={buildTypeLabel(landingPageBuild)} />
            <InfoRow
              label="Workflow"
              value={landingPageBuild ? "Google Ads" : "Atomic website"}
            />
            <InfoRow label="WP Target" value={build.client?.wpSiteUrl ?? "Pending"} />
            <InfoRow label="Status" value={<Badge variant={statusVariant(build.status)}>{build.status}</Badge>} />
            <InfoRow label="Pages" value={`${pushedCount} of ${pages.length} pushed`} />
            {accessibilityReport && (
              <InfoRow
                label="Accessibility"
                value={
                  accessibilityReport.launchReady
                    ? "No blocking issues"
                    : `${accessibilityReport.summary.fail} blocking issue(s)`
                }
              />
            )}
            <InfoRow label="Started" value={formatDate(build.createdAt)} />
            <InfoRow label="Completed" value={formatDate(build.deployedAt)} />
            <InfoRow label="Build ID" value={build.id} />
            <InfoRow label="Run by" value={build.deployedBy} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}
