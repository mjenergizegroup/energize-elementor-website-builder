import Link from "next/link";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/dashboard/new" className={buttonVariants()}>
          New Build
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent builds</CardTitle>
        </CardHeader>
        <CardContent>
          {builds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No builds yet. Start one with New Build.
            </p>
          ) : (
            <ul className="divide-y">
              {builds.map((build) => {
                const pages = (build.pagesDeployed ?? []) as DeployedPage[];
                return (
                  <li
                    key={build.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {build.client?.name ?? "Unknown client"}
                        </span>
                        <Badge variant={STATUS_VARIANT[build.status] ?? "outline"}>
                          {build.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {build.client?.theme}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
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
                            className="text-xs underline underline-offset-2"
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

      <Card>
        <CardHeader>
          <CardTitle>Saved clients</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved clients yet. Clients are saved automatically on first
              deploy so credentials are reusable on rebuild.
            </p>
          ) : (
            <ul className="divide-y">
              {clients.map((client) => (
                <li
                  key={client.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {client.theme} · {client.wpSiteUrl}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/new?clientId=${client.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
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
