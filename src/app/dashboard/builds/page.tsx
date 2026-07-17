import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type DeployedPage = {
  page: string;
  wpPageId: number;
  editUrl: string;
};

const filters = ["all", "success", "partial", "failed", "pending"];

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

function statusVariant(status: string) {
  if (status === "success") return "default";
  if (status === "partial" || status === "in_progress") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function isLandingPageBuild(theme: string | null | undefined) {
  return theme === "landing-page";
}

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const statusFilter = status !== "all" ? status : undefined;
  const builds = await prisma.build.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      pagesDeployed: true,
      status: true,
      deployedAt: true,
      createdAt: true,
      client: {
        select: {
          name: true,
          theme: true,
        },
      },
    },
  });

  return (
    <main className="page-body">
      <section className="page-banner">
        <div>
          <div className="eyebrow">{"// Build History"}</div>
          <h1 className="page-title">Builds.</h1>
          <p className="page-copy">
            Review every deploy run, filter by status, and open the pushed page
            details.
          </p>
        </div>
        <Link href="/dashboard/new" className={buttonVariants()}>
          New Build
        </Link>
      </section>

      <div className="mb-6 flex flex-wrap gap-0">
        {filters.map((item) => (
          <Link
            key={item}
            href={`/dashboard/builds${item === "all" ? "" : `?status=${item}`}`}
            className={buttonVariants({
              variant: status === item ? "default" : "outline",
              size: "sm",
              className: "-ml-0.5 first:ml-0",
            })}
          >
            {item}
          </Link>
        ))}
      </div>

      <section className="table-block">
        <div className="block-head">
          <h2>Full build history</h2>
          <span className="block-note">{builds.length} builds</span>
        </div>
        <div className="grid-head build-grid">
          <div>#</div>
          <div>Client</div>
          <div>Type</div>
          <div>Workflow</div>
          <div>Status</div>
          <div />
        </div>
        {builds.length === 0 ? (
          <p className="grid-row">No builds match this filter.</p>
        ) : (
          builds.map((build, index) => {
            const pages = (build.pagesDeployed ?? []) as DeployedPage[];
            const landingPageBuild = isLandingPageBuild(build.client?.theme);
            return (
              <div key={build.id} className="grid-row build-grid">
                <div className="idx">{String(index + 1).padStart(2, "0")}</div>
                <div className="min-w-0">
                  <div className="row-name truncate">
                    {build.client?.name ?? "Unknown client"}
                  </div>
                  <span className="row-sub">
                    {formatDate(build.deployedAt ?? build.createdAt)}
                    {pages.length > 0 ? ` / ${pages.length} pages` : ""}
                  </span>
                </div>
                <div className="row-meta">
                  {landingPageBuild ? "Landing Page" : "Website"}
                </div>
                <div className="row-meta">
                  {landingPageBuild ? "Google Ads" : "Atomic Website"}
                </div>
                <div>
                  <Badge variant={statusVariant(build.status)}>{build.status}</Badge>
                </div>
                <Link href={`/dashboard/builds/${build.id}`} className="row-action">
                  Open →
                </Link>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
