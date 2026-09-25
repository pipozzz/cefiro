import { desc, eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { legalAcceptances } from "../schema";

/**
 * Record that a user accepted the legal documents at `version`. Idempotent per
 * (user, version): a repeated accept of the same version is a no-op, so this is
 * safe to call from the sign-up hook without guarding.
 */
export async function recordLegalAcceptance(userId: string, version: string): Promise<void> {
  await db
    .insert(legalAcceptances)
    .values({ userId, version })
    .onConflictDoNothing({ target: [legalAcceptances.userId, legalAcceptances.version] });
}

/** The user's most recent acceptance, or null if they have never accepted. */
export async function getLatestLegalAcceptance(
  userId: string
): Promise<{ version: string; acceptedAt: Date } | null> {
  const [row] = await db
    .select({ version: legalAcceptances.version, acceptedAt: legalAcceptances.acceptedAt })
    .from(legalAcceptances)
    .where(eq(legalAcceptances.userId, userId))
    .orderBy(desc(legalAcceptances.acceptedAt))
    .limit(1);

  return row ?? null;
}
