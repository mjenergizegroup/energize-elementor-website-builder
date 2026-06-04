import { listThemes } from "@/lib/injection/registry";
import { prisma } from "@/lib/prisma";
import { BuildWizard, type InitialClient } from "@/components/build-wizard";
import type { BrandKit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const themes = listThemes();

  let initialClient: InitialClient | undefined;
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client) {
      // Never send the stored app password to the browser. On rebuild the user
      // can leave the password blank to reuse the encrypted one on the server.
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

  return <BuildWizard themes={themes} initialClient={initialClient} />;
}
