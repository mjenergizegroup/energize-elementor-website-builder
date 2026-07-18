import Link from "next/link";
import { X } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  BuildWizard,
  type InitialClient,
  type InitialMigrationProject,
} from "@/components/build-wizard";
import { LandingPageWizard } from "@/components/landing-page-wizard";
import { buttonVariants } from "@/components/ui/button";
import type { BrandKit } from "@/lib/types";
import {
  getMigrationProject,
  parseMigrationCompileBundle,
  parseMigrationResolutions,
  parseMigrationSourcePages,
  parseMigrationWizardWorkspace,
} from "@/lib/migration/projects";
import { listReadyLayouts } from "@/lib/layouts/repository";
import { listPagePlan } from "@/lib/page-plan/repository";
import { listContentMatches } from "@/lib/content-matches/repository";
import { listPreparedDrafts } from "@/lib/prepared-drafts/repository";

export const dynamic = "force-dynamic";

const buildTypes = [
  {
    key: "landing-page",
    code: "LP",
    type: "Google Ads",
    title: "Landing Page Build",
    desc: "Build one or more Atomic Google Ads landing pages, apply brand variables, and push drafts to WordPress.",
  },
  {
    key: "migrate",
    code: "MG",
    type: "Migration",
    title: "Migrate a Website",
    desc: "Move an existing dental site into the shared Elementor Atomic workflow, starting with source page crawl.",
    featured: true,
  },
  {
    key: "new-website",
    code: "NW",
    type: "New build",
    title: "New Website Build",
    desc: "Build a new dental practice website from scratch with selected page layouts, content, brand variables, and WordPress setup.",
  },
];

export default async function NewBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; projectId?: string; type?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();
  const { clientId: requestedClientId, projectId, type } = await searchParams;
  let initialMigrationProject: InitialMigrationProject | undefined;
  let clientId = requestedClientId;
  if (projectId) {
    try {
      const project = await getMigrationProject(userId, projectId);
      clientId = project.clientId ?? clientId;
      initialMigrationProject = {
        id: project.id,
        crawlJobId: project.crawlJobId ?? undefined,
        name: project.name,
        sourceUrl: project.sourceUrl ?? undefined,
        status: project.status,
        stage: project.stage,
        sourcePages: parseMigrationSourcePages(project.sourcePages),
        compileBundle: parseMigrationCompileBundle(project.selectedTemplates),
        resolutions: parseMigrationResolutions(project.resolutions),
        workspace: parseMigrationWizardWorkspace(project.wizardWorkspace),
        pagePlan: await listPagePlan(userId, project.id),
        contentMatches: await listContentMatches(userId, project.id),
        preparedDrafts: await listPreparedDrafts(userId, project.id),
      };
    } catch {
      notFound();
    }
  }
  let initialClient: InitialClient | undefined;
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, createdBy: userId },
    });
    if (client) {
      initialClient = {
        id: client.id,
        name: client.name,
        slug: client.slug,
        wpSiteUrl: client.wpSiteUrl,
        wpUsername: client.wpUsername,
        brandKit: client.brandKit as unknown as BrandKit,
      };
    }
  }

  const selectedType = projectId ? "migrate" : type;
  if (selectedType) {
    if (selectedType === "landing-page") {
      return <LandingPageWizard initialClient={initialClient} />;
    }

    return (
      <BuildWizard
        initialClient={initialClient}
        initialMigrationProject={initialMigrationProject}
        initialLayouts={await listReadyLayouts(userId)}
        buildType={selectedType}
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
          <div className="mt-6 border-t-2 border-[var(--color-black)] pt-4 text-[12px] text-[var(--color-muted)]">
            Setting up the WP Engine default site?{" "}
            <a
              href="/downloads/energize-atomic-foundation.zip"
              className="font-bold text-[var(--color-black)] underline underline-offset-4"
              download
            >
              Download the Energize Atomic Foundation
            </a>
            {" · "}
            <a
              href="/downloads/energize-atomic-style-guide.json"
              className="font-bold text-[var(--color-black)] underline underline-offset-4"
              download
            >
              Download the Atomic Style Guide
            </a>
            {" · "}
            <a
              href="/downloads/energize-build-tool-wpcode-snippet.txt"
              className="font-bold text-[var(--color-black)] underline underline-offset-4"
              download
            >
              Download the WPCode Bridge
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
