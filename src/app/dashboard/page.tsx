import Link from "next/link";
import { Plus, RotateCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type DeployedPage = {
  page: string;
  wpPageId: number;
  editUrl: string;
  viewUrl?: string;
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

function statusVariant(status: string) {
  if (status === "success") return "default";
  if (status === "partial" || status === "in_progress") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function buildTypeLabel(type: string | null | undefined) {
  return type === "landing_page" ? "Landing Page" : "Website";
}

export default async function DashboardPage() {
  const [builds, clients, buildCount30d, successCount30d] = await Promise.all([
    prisma.build.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { client: true },
    }),
    prisma.client.findMany({ orderBy: { updatedAt: "desc" }, take: 3 }),
    prisma.build.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.build.count({
      where: {
        status: "success",
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const successRate =
    buildCount30d > 0 ? Math.round((successCount30d / buildCount30d) * 100) : 0;

  return (
    <main className="page-body">
      <section className="page-banner">
        <div>
          <div className="eyebrow">{"// Workspace"}</div>
          <h1 className="page-title">Dashboard.</h1>
          <p className="page-copy">
            Track recent WordPress builds and restart saved client workflows.
          </p>
        </div>
        <Link href="/dashboard/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" />
          New Build
        </Link>
      </section>

      <section className="stat-grid" aria-label="Production stats">
        <div className="stat-cell">
          <div className="stat-label">Builds (30d)</div>
          <div className="stat-value">{buildCount30d}</div>
          <div className="stat-delta">↑ Live from build history</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Success rate</div>
          <div className="stat-value">
            {successRate}
            <span>%</span>
          </div>
          <div className="stat-delta">↑ Successful deploys</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Saved clients</div>
          <div className="stat-value">{clients.length}</div>
          <div className="stat-delta">↑ Ready for rebuild</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Recent builds</div>
          <div className="stat-value">{builds.length}</div>
          <div className="stat-delta">↑ Latest activity</div>
        </div>
      </section>

      <section className="table-block">
        <div className="block-head">
          <h2>Recent builds</h2>
          <span className="block-note">Last {builds.length} builds</span>
          <Link href="/dashboard/builds" className="view-all">
            View all builds →
          </Link>
        </div>
        <div className="grid-head build-grid">
          <div>#</div>
          <div>Client</div>
          <div>Type</div>
          <div>Theme</div>
          <div>Status</div>
          <div />
        </div>
        {builds.length === 0 ? (
          <p className="grid-row">No builds yet. Start one with New Build.</p>
        ) : (
          builds.map((build, index) => {
            const pages = (build.pagesDeployed ?? []) as DeployedPage[];
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
                <div className="row-meta">{buildTypeLabel(build.type)}</div>
                <div className="row-meta">
                  {build.type === "landing_page"
                    ? "Google Ads"
                    : build.client?.theme ?? "Pending"}
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

      <section className="table-block">
        <div className="block-head">
          <h2>Saved clients</h2>
          <span className="block-note">{clients.length} shown</span>
          <Link href="/dashboard/clients" className="view-all">
            All clients →
          </Link>
        </div>
        <div className="grid-head client-grid">
          <div>#</div>
          <div>Practice</div>
          <div>Theme</div>
          <div>WP Target</div>
          <div />
        </div>
        {clients.length === 0 ? (
          <p className="grid-row">No saved clients yet. Clients appear after first deploy.</p>
        ) : (
          clients.map((client, index) => (
            <div key={client.id} className="grid-row client-grid">
              <div className="idx">{String(index + 1).padStart(2, "0")}</div>
              <div className="row-name truncate">{client.name}</div>
              <div className="row-meta">{client.theme}</div>
              <div className="row-sub truncate">{client.wpSiteUrl}</div>
              <Link
                href={`/dashboard/new?type=new-website&clientId=${client.id}`}
                className="row-action inline-flex items-center gap-1"
              >
                <RotateCw className="size-3" />
                Rebuild
              </Link>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
