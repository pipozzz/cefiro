import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { notifications, recipes, userProfiles } from "../schema";

export type NotificationType = "follow" | "like" | "comment";

export interface CreateNotificationInput {
  userId: string;
  actorId: string;
  type: NotificationType;
  recipeId?: string | null;
}

/**
 * Insert a notification. No-op when the actor is the recipient (you never get
 * notified about your own actions).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (input.userId === input.actorId) {
    return;
  }

  await db.insert(notifications).values({
    userId: input.userId,
    actorId: input.actorId,
    type: input.type,
    recipeId: input.recipeId ?? null,
  });
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  createdAt: Date;
  readAt: Date | null;
  actorHandle: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  recipeSlug: string | null;
  recipeName: string | null;
}

export async function listNotifications(
  userId: string,
  limit: number,
  cursor?: string
): Promise<{ items: NotificationRow[]; nextCursor: string | null }> {
  const conditions = [eq(notifications.userId, userId)];

  if (cursor) {
    const cursorDate = new Date(cursor);

    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(notifications.createdAt, cursorDate));
    }
  }

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorHandle: userProfiles.handle,
      actorDisplayName: userProfiles.displayName,
      actorAvatarUrl: userProfiles.avatarUrl,
      recipeSlug: recipes.slug,
      recipeName: recipes.name,
    })
    .from(notifications)
    .leftJoin(userProfiles, eq(userProfiles.userId, notifications.actorId))
    .leftJoin(recipes, eq(recipes.id, notifications.recipeId))
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

  return { items, nextCursor };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

  return row?.c ?? 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
