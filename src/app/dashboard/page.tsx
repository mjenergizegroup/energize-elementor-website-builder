import Link from "next/link";
import { Plus, RotateCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type DeployedPage = {
  page: string;
  wpPageId: number;
  editUrl: string;
  viewUrl: string;
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  in_progress: "secondary",
  pending: "outline",
  partial: "secondary",
  failed: "destructive",
};

export default async function DashboardPage() {
  const [builds, clients] = await Promise.all([
    prisma.build.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { client: true },
    }),
    prisma.client.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-[42px] font-bold leading-none tracking-[-0.025em] text-[var(--ink)]">
            Dashboard
          </h1>
          <p className="max-w-2xl text-sm font-medium text-[var(--muted)]">
            Track recent WordPress builds and restart saved client workflows.
          </p>
        </div>
        <Link href="/dashboard/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" />
          New Build
        </Link>
      </div>

      <Card className="shadow-[var(--shadow-lg)]">
        <CardHeader className="border-b border-[var(--line)] bg-[var(--paper-2)] py-5">
          <CardTitle>Recent builds</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {builds.length === 0 ? (
            <p className="px-5 py-8 text-sm font-medium text-[var(--muted)]">
              No builds yet. Start one with New Build.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {builds.map((build) => {
                const pages = (build.pagesDeployed ?? []) as DeployedPage[];
                return (
                  <li
                    key={build.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--paper-2)]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--ink)]">
                          {build.client?.name ?? "Unknown client"}
                        </span>
                        <Badge variant={STATUS_VARIANT[build.status] ?? "outline"}>
                          {build.status}
                        </Badge>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          {build.client?.theme}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] font-medium text-[var(--muted)]">
                        {build.deployedAt
                          ? new Date(build.deployedAt).toLocaleString()
                          : new Date(build.createdAt).toLocaleString()}
                        {pages.length > 0 ? ` · ${pages.length} pages` : ""}
                      </div>
                    </div>
                    {pages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {pages.map((p) => (
                          <a
                            key={p.wpPageId}
                            href={p.editUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--primary-deep)]"
                          >
                            {p.page}
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-lg)]">
        <CardHeader className="border-b border-[var(--line)] bg-[var(--paper-2)] py-5">
          <CardTitle>Saved clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <p className="px-5 py-8 text-sm font-medium text-[var(--muted)]">
              No saved clients yet. Clients are saved automatically on first
              deploy so credentials are reusable on rebuild.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {clients.map((client) => (
                <li
                  key={client.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--paper-2)]"
                >
                  <div>
                    <div className="font-semibold text-[var(--ink)]">{client.name}</div>
                    <div className="font-mono text-[11px] font-medium text-[var(--muted)]">
                      {client.theme} · {client.wpSiteUrl}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/new?clientId=${client.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <RotateCw data-icon="inline-start" />
                    Rebuild
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
