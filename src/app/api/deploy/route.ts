import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { resolveClient } from "@/lib/clients";
import { checkDeployRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { WpClient } from "@/lib/wp/client";
import { runDeploy } from "@/lib/deploy/orchestrate";
import { deployBodySchema } from "@/lib/deploy/schema";
import type { DeployEvent, DeployedPageRecord } from "@/lib/deploy/types";
import type { AccessibilityReport } from "@/lib/accessibility/audit";

export const runtime = "nodejs";
export const maxDuration = 120;

function ndjson(event: DeployEvent): string {
  return JSON.stringify(event) + "\n";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: z.infer<typeof deployBodySchema>;
  try {
    body = deployBodySchema.parse(await req.json());
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Invalid request body",
        detail: e instanceof z.ZodError ? e.issues : String(e),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Rate limit: 5 deploys per user per minute.
  const rate = await checkDeployRateLimit(userId);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: `Rate limit reached (${rate.max} deploys per minute). Try again shortly.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  // Resolve (or create) the client and decrypt its WP credentials.
  const client = await resolveClient(userId, body.clientId, {
    name: body.client.name,
    slug: body.client.slug,
    theme: body.client.theme,
    wpSiteUrl: body.client.wpSiteUrl,
    wpUsername: body.client.wpUsername,
    wpAppPassword: body.client.wpAppPassword,
    brandKit: body.brandKit,
  });

  const build = await prisma.build.create({
    data: {
      clientId: client.id,
      status: "in_progress",
      deployedBy: userId,
    },
    select: { id: true },
  });

  await audit(userId, "deploy.start", client.id, {
    buildId: build.id,
    theme: client.theme,
    deployMode: body.deployMode,
    pages: body.content.pages.map((p) => p.slug ?? p.page),
  });

  const encoder = new TextEncoder();
  const deployed: DeployedPageRecord[] = [];
  let accessibilityReport: AccessibilityReport | undefined;
  let anyFail = false;
  let fatal = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: DeployEvent) =>
        controller.enqueue(encoder.encode(ndjson(event)));

      try {
        // Pre-flight: validate the WP site + application password.
        const wp = new WpClient(client.wpSiteUrl);
        send({
          type: "step",
          step: "page",
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
          step: "page",
          status: "ok",
          label: "WordPress connection OK",
        });

        for await (const event of runDeploy({
          deployMode: body.deployMode,
          theme: client.theme,
          siteUrl: client.wpSiteUrl,
          siteName: client.name,
          wpUsername: client.wpUsername,
          wpAppPassword: client.appPassword,
          content: body.content,
          brandKit: body.brandKit,
          elementorVersion: body.elementorVersion,
        })) {
          if (event.status === "fail") anyFail = true;
          if (event.type === "fatal") fatal = true;
          if (event.accessibilityReport) {
            accessibilityReport = event.accessibilityReport;
          }
          if (event.status === "ok" && event.data?.wpPageId) {
            deployed.push({
              page: event.data.page!,
              title: event.data.title ?? event.data.page!,
              wpPageId: event.data.wpPageId,
              editUrl: event.data.editUrl!,
              viewUrl: event.data.viewUrl!,
              status: "draft",
              kind: "content",
            });
          }
          send(event);
        }
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
              errorLog: accessibilityReport
                ? JSON.stringify({ accessibilityReport })
                : undefined,
            },
            select: { id: true },
          });
          await audit(userId, "deploy.finish", client.id, {
            buildId: build.id,
            status,
            pagesDeployed: deployed.length,
            accessibilitySummary: accessibilityReport?.summary,
          });
        } catch (e) {
          console.error("failed to finalize build record", e);
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
