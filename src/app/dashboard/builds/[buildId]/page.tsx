import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, RotateCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type DeployedPage = {
  page: string;
  wpPageId: number;
  editUrl: string;
  viewUrl?: string;
  status?: string;
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
  if (status === "partial" || status === "in_progress") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function isLandingPageBuild(theme: string | null | undefined) {
  return theme === "landing-page";
}

function buildTypeLabel(landingPageBuild: boolean) {
  return landingPageBuild ? "Landing Page build" : "Website build";
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

  return (
    <main className="page-body">
      <section className="detail-head">
        <div className="min-w-0">
          <Link
            href="/dashboard/builds"
            className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-muted)] hover:text-[var(--color-red)]"
          >
            <ArrowLeft className="size-3" />
            All builds
          </Link>
          <h1 className="truncate text-[28px] font-black leading-none tracking-[-0.035em]">
            {build.client?.name ?? "Unknown client"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-muted)]">
            <Badge variant={statusVariant(build.status)}>{build.status}</Badge>
            <span>{buildTypeLabel(landingPageBuild)}</span>
            <span>{landingPageBuild ? "Google Ads" : `${build.client?.theme ?? "Pending"} theme`}</span>
            <span>{formatDate(build.deployedAt ?? build.createdAt)}</span>
            <span>Build ID: {build.id}</span>
          </div>
        </div>
        <div className="flex gap-0">
          <Link
            href={
              build.client
                ? `/dashboard/new?type=${landingPageBuild ? "landing-page" : "new-website"}&clientId=${build.client.id}`
                : "/dashboard/new"
            }
            className={buttonVariants({ className: "-mr-0.5" })}
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
                    className="truncate text-[12px] font-medium text-[var(--color-red)] hover:underline"
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

        <aside className="info-panel self-start">
          <div className="block-head">
            <h2>Build info</h2>
          </div>
          <div>
            <InfoRow label="Client" value={build.client?.name ?? "Unknown client"} />
            <InfoRow label="Build type" value={buildTypeLabel(landingPageBuild)} />
            <InfoRow
              label={landingPageBuild ? "Campaign type" : "Theme"}
              value={landingPageBuild ? "Google Ads" : build.client?.theme ?? "Pending"}
            />
            <InfoRow label="WP Target" value={build.client?.wpSiteUrl ?? "Pending"} />
            <InfoRow label="Status" value={<Badge variant={statusVariant(build.status)}>{build.status}</Badge>} />
            <InfoRow label="Pages" value={`${pushedCount} of ${pages.length} pushed`} />
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
