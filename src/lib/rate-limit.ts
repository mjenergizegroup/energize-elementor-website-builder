import "server-only";
import { prisma } from "@/lib/prisma";

// Deploy rate limit: max 5 deploys per user per minute. Counts Build rows so it
// holds across serverless instances (an in-memory limiter would not).
export async function checkDeployRateLimit(
  userId: string,
  max = 5,
  windowMs = 60_000,
): Promise<{ allowed: boolean; count: number; max: number }> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.build.count({
    where: { deployedBy: userId, createdAt: { gte: since } },
  });
  return { allowed: count < max, count, max };
}
