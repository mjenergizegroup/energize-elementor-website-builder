import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { resolveClient } from "@/lib/clients";
import {
  assertLandingPageTemplateName,
  injectLandingPage,
} from "@/lib/landing-pages/inject";
import { prisma } from "@/lib/prisma";
import { checkDeployRateLimit } from "@/lib/rate-limit";
import {
  toCustomColors,
  toSystemColors,
  toSystemTypography,
} from "@/lib/wp/brand";
import { WpClient } from "@/lib/wp/client";

export const runtime = "nodejs";
export const maxDuration = 120;

type LandingPageDeployEvent = {
  type: "step" | "done" | "fatal";
  status: "start" | "ok" | "fail";
  label: string;
  message?: string;
  data?: {
    page?: string;
    title?: string;
    wpPageId?: number;
    editUrl?: string;
    viewUrl?: string;
    populatedSlots?: number;
    missingSlots?: number;
  };
};

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color.");

const assetSchema = z.object({
  filename: z.string().min(1),
  dataBase64: z.string().min(1),
});

const bodySchema = z.object({
  clientId: z.string().optional(),
  client: z.object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and dashes"),
    wpSiteUrl: z.string().url(),
    wpUsername: z.string().min(1),
    wpAppPassword: z.string().optional(),
  }),
  brandKit: z.object({
    colors: z.object({
      primary: hexColorSchema,
      secondary: hexColorSchema,
      accent: hexColorSchema,
      text: hexColorSchema,
      background: hexColorSchema,
    }),
    fonts: z.object({ heading: z.string().min(1), body: z.string().min(1) }),
    logo: assetSchema,
    favicon: assetSchema,
  }),
  pages: z
    .array(
      z.object({
        pageName: z.string().min(1),
        pageTitle: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and dashes"),
        templateName: z.string().min(1),
        contentJson: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
  elementorVersion: z.string().optional(),
});

function ndjson(event: LandingPageDeployEvent): string {
  return JSON.stringify(event) + "\n";
}

async function landingStep(
  send: (event: LandingPageDeployEvent) => void,
  label: string,
  action: () => Promise<void>,
): Promise<boolean> {
  send({ type: "step", status: "start", label });
  try {
    await action();
    send({ type: "step", status: "ok", label });
    return true;
  } catch (e) {
    send({
      type: "step",
      status: "fail",
      label,
      message: e instanceof Error ? e.message : "Step failed",
    });
    return false;
  }
}

async function createLandingPageBuildRecord({
  clientId,
  userId,
}: {
  clientId: string;
  userId: string;
}) {
  return prisma.build.create({
    data: {
      clientId,
      status: "in_progress",
      deployedBy: userId,
    },
    select: { id: true },
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
    for (const page of body.pages) {
      assertLandingPageTemplateName(page.templateName);
    }
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Invalid request body",
        detail: e instanceof z.ZodError ? e.issues : String(e),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const rate = await checkDeployRateLimit(userId);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: `Rate limit reached (${rate.max} deploys per minute). Try again shortly.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  let client: Awaited<ReturnType<typeof resolveClient>>;
  let build: { id: string };
  try {
    client = await resolveClient(userId, body.clientId, {
      name: body.client.name,
      slug: body.client.slug,
      theme: "landing-page",
      wpSiteUrl: body.client.wpSiteUrl,
      wpUsername: body.client.wpUsername,
      wpAppPassword: body.client.wpAppPassword,
      brandKit: body.brandKit,
    });

    build = await createLandingPageBuildRecord({
      clientId: client.id,
      userId,
    });

    await audit(userId, "landing-page.deploy.start", client.id, {
      buildId: build.id,
      pages: body.pages.map((page) => page.slug),
      colors: body.brandKit.colors,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Could not prepare the landing page deploy.",
        detail: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const deployed: {
    page: string;
    title: string;
    template: string;
    populatedSlots: number;
    missingSlots: number;
    wpPageId: number;
    editUrl: string;
    viewUrl: string;
    status: "draft";
  }[] = [];
  let anyFail = false;
  let fatal = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LandingPageDeployEvent) =>
        controller.enqueue(encoder.encode(ndjson(event)));

      try {
        const wp = new WpClient(client.wpSiteUrl);
        send({
          type: "step",
          status: "start",
          label: "Checking WordPress connection",
        });
        const conn = await wp.checkConnection(client.wpUsername, client.appPassword);
        if (!conn.ok) {
          fatal = true;
          send({
            type: "fatal",
            status: "fail",
            label: "Connection check failed",
            message: conn.detail,
          });
          return;
        }
        send({
          type: "step",
          status: "ok",
          label: "WordPress connection OK",
        });

        for (const page of body.pages) {
          assertLandingPageTemplateName(page.templateName);
          const label = `Creating ${page.pageTitle}`;
          send({ type: "step", status: "start", label });

          try {
            const injected = injectLandingPage(page.templateName, page.contentJson);
            const elementorData = Array.isArray(injected.data.content)
              ? injected.data.content
              : [];
            const result = await wp.createPage({
              title: page.pageTitle,
              slug: page.slug,
              template: "elementor_header_footer",
              elementorData,
              elementorVersion:
                body.elementorVersion ??
                (typeof injected.data.version === "string"
                  ? injected.data.version
                  : undefined),
              status: "draft",
            });

            deployed.push({
              page: page.pageName,
              title: page.pageTitle,
              template: page.templateName,
              populatedSlots: injected.populatedSlots.length,
              missingSlots: injected.missingSlots.length,
              wpPageId: result.id,
              editUrl: result.editUrl,
              viewUrl: result.viewUrl,
              status: "draft",
            });

            send({
              type: "step",
              status: "ok",
              label,
              data: {
                page: page.pageName,
                title: page.pageTitle,
                wpPageId: result.id,
                editUrl: result.editUrl,
                viewUrl: result.viewUrl,
                populatedSlots: injected.populatedSlots.length,
                missingSlots: injected.missingSlots.length,
              },
            });
          } catch (e) {
            anyFail = true;
            send({
              type: "step",
              status: "fail",
              label,
              message: e instanceof Error ? e.message : "Page creation failed",
            });
          }
        }

        if (!(await landingStep(send, "Setting site name", async () => {
          await wp.setSiteName(client.wpUsername, client.appPassword, client.name);
        }))) {
          anyFail = true;
        }

        if (!(await landingStep(send, "Setting brand colors", async () => {
          await wp.setBrandColors(
            toSystemColors(body.brandKit.colors),
            toCustomColors(body.brandKit.colors),
          );
        }))) {
          anyFail = true;
        }

        if (!(await landingStep(send, "Setting brand fonts", async () => {
          await wp.setBrandFonts(toSystemTypography(body.brandKit.fonts));
        }))) {
          anyFail = true;
        }

        if (!(await landingStep(send, "Setting site logo", async () => {
          await wp.setLogo(body.brandKit.logo.filename, body.brandKit.logo.dataBase64);
        }))) {
          anyFail = true;
        }

        if (!(await landingStep(send, "Setting site favicon", async () => {
          await wp.setFavicon(
            body.brandKit.favicon.filename,
            body.brandKit.favicon.dataBase64,
          );
        }))) {
          anyFail = true;
        }

        if (!(await landingStep(send, "Flushing Elementor CSS cache", async () => {
          await wp.flushCss();
        }))) {
          anyFail = true;
        }

        send({ type: "done", status: "ok", label: "Deploy complete" });
      } catch (e) {
        fatal = true;
        send({
          type: "fatal",
          status: "fail",
          label: "Deploy failed",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        const status = fatal ? "failed" : anyFail ? "partial" : "success";
        try {
          await prisma.build.update({
            where: { id: build.id },
            data: {
              status,
              deployedAt: new Date(),
              pagesDeployed: deployed as unknown as object,
            },
            select: { id: true },
          });
          await audit(userId, "landing-page.deploy.finish", client.id, {
            buildId: build.id,
            status,
            pagesDeployed: deployed.length,
          });
        } catch (e) {
          console.error("failed to finalize landing page build record", e);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Build-Id": build.id,
    },
  });
}
