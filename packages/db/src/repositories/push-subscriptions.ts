import { and, eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { pushSubscriptions } from "../schema";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Store (or refresh) a browser's push subscription for a user. Keyed on the
 * endpoint: the same browser re-subscribing updates its keys and owner rather
 * than creating a duplicate.
 */
export async function upsertPushSubscription(
  userId: string,
  sub: PushSubscriptionKeys
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth },
    });
}

/** Remove a browser's subscription (the user turned push off in that browser). */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/** Remove a dead subscription by endpoint, whoever owns it (push service said gone). */
export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Every push subscription for a user, across their browsers/devices. */
export async function listPushSubscriptionsForUser(
  userId: string
): Promise<PushSubscriptionKeys[]> {
  const rows = await db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  return rows;
}
