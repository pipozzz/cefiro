import { eq, sql } from "drizzle-orm";

import type { PaidPlanId } from "@norish/shared/lib/plans";
import { db } from "@norish/db/drizzle";

import { subscriptions } from "../schema";

export interface SubscriptionRecord {
  userId: string;
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/** Provider statuses that still grant access (past_due keeps a short grace). */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function toRecord(row: typeof subscriptions.$inferSelect): SubscriptionRecord {
  return {
    userId: row.userId,
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  };
}

/** The user's subscription row, whatever its status, or null if none. */
export async function getSubscriptionForUser(userId: string): Promise<SubscriptionRecord | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return row ? toRecord(row) : null;
}

/**
 * The user's currently-effective subscription, or null when they are on free.
 * A row counts while its status is active/trialing/past_due, and a canceled row
 * keeps access until the paid period it was already paid for actually ends.
 */
export async function getActiveSubscriptionForUser(
  userId: string
): Promise<SubscriptionRecord | null> {
  const row = await getSubscriptionForUser(userId);

  if (!row) {
    return null;
  }

  const withinPaidPeriod = !row.currentPeriodEnd || row.currentPeriodEnd.getTime() > Date.now();

  if (!withinPaidPeriod) {
    return null;
  }

  if (ACTIVE_STATUSES.has(row.status) || row.status === "canceled") {
    return row;
  }

  return null;
}

export interface UpsertSubscriptionInput {
  userId: string;
  plan: PaidPlanId;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}

/**
 * Create or update a user's subscription (one per user). Called by the Stripe
 * webhook as the provider is the source of truth.
 */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  const values = {
    userId: input.userId,
    plan: input.plan,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan: values.plan,
        status: values.status,
        stripeCustomerId: values.stripeCustomerId,
        stripeSubscriptionId: values.stripeSubscriptionId,
        currentPeriodEnd: values.currentPeriodEnd,
        updatedAt: new Date(),
        version: sql`${subscriptions.version} + 1`,
      },
    });
}
