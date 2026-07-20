import { Download } from "lucide-react";
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
import { BuildTypeLink } from "@/components/build-type-link";
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
    title: "Landing Page Build",
    desc: "Build one or more Atomic landing pages, apply brand variables, and push drafts to WordPress.",
  },
  {
    key: "migrate",
    title: "Migrate a Website",
    desc: "Move an existing dental site into the shared Elementor Atomic workflow, starting with source page crawl.",
  },
  {
    key: "new-website",
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
    const selectedBuild = buildTypes.find((item) => item.key === selectedType);
    if (!selectedBuild) notFound();

    const wizard = selectedType === "landing-page" ? (
      <LandingPageWizard initialClient={initialClient} embedded />
    ) : (
      <BuildWizard
        initialClient={initialClient}
        initialMigrationProject={initialMigrationProject}
        initialLayouts={await listReadyLayouts(userId)}
        buildType={selectedType}
        embedded
      />
    );

    const chooserHref = clientId
      ? `/dashboard/new?clientId=${encodeURIComponent(clientId)}`
      : "/dashboard/new";

    return (
      <main className="page-body">
        <RouteSideDrawer
          closeHref="/dashboard"
          backHref={projectId ? undefined : chooserHref}
          title={selectedBuild.title}
          description={selectedBuild.desc}
          size="workspace"
          tone="soft"
          bodyClassName="side-drawer-body-workspace"
        >
          {wizard}
        </RouteSideDrawer>
      </main>
    );
  }

  return (
    <main className="page-body">
      <RouteSideDrawer
        closeHref="/dashboard"
        title="What are you building?"
        description="Choose a workflow. The next screen will guide you through the steps for that build type."
        size="workspace"
        tone="soft"
        bodyClassName="side-drawer-body-selector"
      >
        <div className="side-drawer-selector-content">
          <div className="grid gap-3">
          {buildTypes.map((item) => {
            const query = new URLSearchParams({ type: item.key });
            if (requestedClientId) query.set("clientId", requestedClientId);

            return (
              <BuildTypeLink
                key={item.key}
                href={`/dashboard/new?${query.toString()}`}
                title={item.title}
                description={item.desc}
              />
            );
          })}
          </div>

          <section className="mt-8 rounded-lg bg-[var(--color-surface-raised)] p-5 shadow-xs">
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
        </div>
      </RouteSideDrawer>
    </main>
  );
}
