import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import type { BrandKit } from "@/lib/types";

const DEFAULT_COMPATIBILITY_THEME = "elevate";

export interface ResolvedClient {
  id: string;
  name: string;
  slug: string;
  wpSiteUrl: string;
  wpUsername: string;
  appPassword: string; // decrypted
  theme: string;
  brandKit: BrandKit;
}

export interface ClientInput {
  name: string;
  slug: string;
  theme?: string;
  wpSiteUrl: string;
  wpUsername: string;
  wpAppPassword?: string; // required when creating; optional on rebuild
  brandKit: BrandKit;
}

// Load an existing client (decrypting its stored app password) or create one.
// On rebuild (clientId provided) the brand kit is refreshed and legacy theme
// metadata is preserved unless an older caller explicitly supplies it.
export async function resolveClient(
  userId: string,
  clientId: string | undefined,
  input: ClientInput,
): Promise<ResolvedClient> {
  if (clientId) {
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (!existing || existing.createdBy !== userId) {
      throw new Error(`Client ${clientId} not found`);
    }
    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        name: input.name,
        wpSiteUrl: input.wpSiteUrl,
        wpUsername: input.wpUsername,
        ...(input.theme ? { theme: input.theme } : {}),
        brandKit: input.brandKit as unknown as object,
        ...(input.wpAppPassword
          ? { wpAppPasswordEncrypted: encrypt(input.wpAppPassword) }
          : {}),
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      wpSiteUrl: updated.wpSiteUrl,
      wpUsername: updated.wpUsername,
      appPassword: decrypt(updated.wpAppPasswordEncrypted),
      theme: updated.theme,
      brandKit: updated.brandKit as unknown as BrandKit,
    };
  }

  if (!input.wpAppPassword) {
    throw new Error("An application password is required to create a client.");
  }

  const slugMatch = await prisma.client.findUnique({
    where: { slug: input.slug },
  });
  if (slugMatch && slugMatch.createdBy !== userId) {
    throw new Error("That client slug is already in use.");
  }
  const created = slugMatch
    ? await prisma.client.update({
        where: { id: slugMatch.id },
        data: {
          name: input.name,
          wpSiteUrl: input.wpSiteUrl,
          wpUsername: input.wpUsername,
          theme: input.theme ?? slugMatch.theme,
          brandKit: input.brandKit as unknown as object,
          wpAppPasswordEncrypted: encrypt(input.wpAppPassword),
        },
      })
    : await prisma.client.create({
        data: {
          name: input.name,
          slug: input.slug,
          wpSiteUrl: input.wpSiteUrl,
          wpUsername: input.wpUsername,
          theme: input.theme ?? DEFAULT_COMPATIBILITY_THEME,
          brandKit: input.brandKit as unknown as object,
          wpAppPasswordEncrypted: encrypt(input.wpAppPassword),
          createdBy: userId,
        },
      });

  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    wpSiteUrl: created.wpSiteUrl,
    wpUsername: created.wpUsername,
    appPassword: decrypt(created.wpAppPasswordEncrypted),
    theme: created.theme,
    brandKit: created.brandKit as unknown as BrandKit,
  };
}
