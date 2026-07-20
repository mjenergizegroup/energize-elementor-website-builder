import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  BuildWizard,
  type InitialClient,
  type InitialMigrationProject,
} from "@/components/build-wizard";
import { LandingPageWizard } from "@/components/landing-page-wizard";
import { RouteSideDrawer } from "@/components/route-side-drawer";
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
    <main className="page-body">
      <RouteSideDrawer
        closeHref="/dashboard"
        eyebrow="New build"
        title="What are you building?"
        description="Choose a workflow. The next screen will guide you through the steps for that build type."
        size="wide"
      >
        <div className="grid gap-3">
          {buildTypes.map((item) => (
            <Link
              key={item.key}
              href={`/dashboard/new?type=${item.key}`}
              className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-lg bg-[var(--color-surface)] p-5 shadow-xs outline-none transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[var(--color-primary-tint)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <div className="card-num mt-0.5" data-featured={item.featured}>
                {item.code}
              </div>
              <div className="min-w-0">
                <div className="label-type">{item.type}</div>
                <h2 className="mt-1 text-base font-semibold tracking-[-0.015em] text-[var(--color-text-primary)]">
                  {item.title}
                </h2>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {item.desc}
                </p>
              </div>
              <ArrowRight className="mt-2 size-5 text-[var(--color-text-faint)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--color-primary-hover)]" />
            </Link>
          ))}
        </div>

        <section className="mt-8 rounded-lg bg-[var(--color-surface)] p-5">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Setting up a WP Engine default site?
              </h2>
              <div className="mt-3 grid gap-2 text-xs">
                <a
                  href="/downloads/energize-atomic-foundation.zip"
                  className="font-semibold text-[var(--color-primary-hover)] hover:underline hover:underline-offset-4"
                  download
                >
                  Energize Atomic Foundation
                </a>
                <a
                  href="/downloads/energize-atomic-style-guide.json"
                  className="font-semibold text-[var(--color-primary-hover)] hover:underline hover:underline-offset-4"
                  download
                >
                  Atomic Style Guide
                </a>
                <a
                  href="/downloads/energize-build-tool-wpcode-snippet.txt"
                  className="font-semibold text-[var(--color-primary-hover)] hover:underline hover:underline-offset-4"
                  download
                >
                  WPCode Bridge
                </a>
              </div>
            </div>
          </div>
        </section>
      </RouteSideDrawer>
    </main>
  );
}
