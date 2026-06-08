import Link from "next/link";
import { X } from "lucide-react";
import { listThemes } from "@/lib/injection/registry";
import { prisma } from "@/lib/prisma";
import { BuildWizard, type InitialClient } from "@/components/build-wizard";
import { buttonVariants } from "@/components/ui/button";
import type { BrandKit } from "@/lib/types";

export const dynamic = "force-dynamic";

const buildTypes = [
  {
    key: "landing-page",
    code: "LP",
    type: "Google Ads",
    title: "Landing Page Build",
    desc: "Build one or more Google Ads landing pages, set the brand kit, and push draft pages to WordPress.",
  },
  {
    key: "migrate",
    code: "MG",
    type: "Migration",
    title: "Migrate a Website",
    desc: "Move an existing dental site into a WordPress theme workflow, starting with source page crawl.",
    featured: true,
  },
  {
    key: "new-website",
    code: "NW",
    type: "New build",
    title: "New Website Build",
    desc: "Build a new dental practice website from scratch with theme, content, brand, and WordPress setup.",
  },
];

export default async function NewBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; type?: string }>;
}) {
  const { clientId, type } = await searchParams;
  const themes = listThemes();

  let initialClient: InitialClient | undefined;
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client) {
      initialClient = {
        id: client.id,
        name: client.name,
        slug: client.slug,
        theme: client.theme,
        wpSiteUrl: client.wpSiteUrl,
        wpUsername: client.wpUsername,
        brandKit: client.brandKit as unknown as BrandKit,
      };
    }
  }

  if (type) {
    return (
      <BuildWizard
        themes={themes}
        initialClient={initialClient}
        buildType={type}
      />
    );
  }

  return (
    <main className="modal-overlay">
      <section className="modal-panel" aria-labelledby="new-build-title">
        <div className="modal-head">
          <div>
            <div className="eyebrow">{"// New build"}</div>
            <h1 id="new-build-title" className="text-[13px] font-bold tracking-[-0.01em] text-white">
              Select build type
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="ml-auto flex size-7 items-center justify-center border border-[#444444] text-[#888888] hover:text-white"
            aria-label="Close new build selector"
          >
            <X className="size-4" />
          </Link>
        </div>
        <div className="modal-body">
          <p className="mb-6 max-w-[540px] text-[13px] leading-6 text-[var(--color-muted)]">
            Choose what you are building. Each path walks you through the steps
            specific to that type.
          </p>
          <div className="modal-cards">
            {buildTypes.map((item) => (
              <article key={item.key} className="modal-card">
                <div className="card-num" data-featured={item.featured}>
                  {item.code}
                </div>
                <div className="label-type">{item.type}</div>
                <h2 className="card-title">{item.title}</h2>
                <p className="card-desc">{item.desc}</p>
                <Link
                  href={`/dashboard/new?type=${item.key}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Select →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
