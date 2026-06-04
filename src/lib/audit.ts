import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Append an audit log entry. Never throws into the caller's critical path.
export async function audit(
  userId: string,
  action: string,
  clientId?: string | null,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        clientId: clientId ?? null,
        metadata: metadata ?? undefined,
      },
    });
  } catch (e) {
    console.error("audit log write failed", e);
  }
}
