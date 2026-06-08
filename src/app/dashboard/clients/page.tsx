import Link from "next/link";
import { RotateCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      builds: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <main className="page-body">
      <section className="page-banner">
        <div>
          <div className="eyebrow">{"// Saved Workspaces"}</div>
          <h1 className="page-title">Clients.</h1>
          <p className="page-copy">
            Reuse saved WordPress targets and brand kits without re-entering
            encrypted credentials.
          </p>
        </div>
        <Link href="/dashboard/new" className={buttonVariants()}>
          New Build
        </Link>
      </section>

      <section className="table-block">
        <div className="block-head">
          <h2>Saved clients</h2>
          <span className="block-note">{clients.length} active workspaces</span>
        </div>
        <div className="grid-head client-grid">
          <div>#</div>
          <div>Practice</div>
          <div>Theme</div>
          <div>WP Target</div>
          <div />
        </div>
        {clients.length === 0 ? (
          <p className="grid-row">No saved clients yet. Deploy a build to create one.</p>
        ) : (
          clients.map((client, index) => (
            <div key={client.id} className="grid-row client-grid">
              <div className="idx">{String(index + 1).padStart(2, "0")}</div>
              <div className="min-w-0">
                <div className="row-name truncate">{client.name}</div>
                <span className="row-sub">
                  Last build: {formatDate(client.builds[0]?.deployedAt ?? client.builds[0]?.createdAt)}
                </span>
              </div>
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
