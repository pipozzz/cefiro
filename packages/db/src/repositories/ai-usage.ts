import { sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { aiUsage } from "../schema";

/** The current usage period as "YYYY-MM" in UTC. */
export function currentAiUsagePeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Atomically consume one AI credit for `userId` in `period` if they are still
 * under `limit`. Returns true when a credit was consumed (the counter was
 * incremented), false when the user is already at the limit.
 *
 * A single `INSERT ... ON CONFLICT DO UPDATE ... WHERE used < limit RETURNING`
 * does the check-and-increment in one statement, so concurrent calls can't both
 * slip past the last credit (Postgres locks the conflicting row).
 */
export async function consumeAiUsage(
  userId: string,
  period: string,
  limit: number
): Promise<boolean> {
  if (limit <= 0) {
    return false;
  }

  const rows = await db
    .insert(aiUsage)
    .values({ userId, period, used: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.period],
      set: { used: sql`${aiUsage.used} + 1`, updatedAt: new Date() },
      setWhere: sql`${aiUsage.used} < ${limit}`,
    })
    .returning({ used: aiUsage.used });

  return rows.length > 0;
}

/** How many AI actions `userId` has used in `period` (0 if none). */
export async function getAiUsage(userId: string, period: string): Promise<number> {
  const [row] = await db
    .select({ used: aiUsage.used })
    .from(aiUsage)
    .where(sql`${aiUsage.userId} = ${userId} AND ${aiUsage.period} = ${period}`)
    .limit(1);

  return row?.used ?? 0;
}
