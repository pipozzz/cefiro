import { and, desc, eq, lt, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { commentReports, recipeComments, userProfiles } from "../schema";

export interface RecipeCommentRow {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
}

export async function addComment(
  userId: string,
  recipeId: string,
  body: string
): Promise<{ id: string }> {
  const [row] = await db
    .insert(recipeComments)
    .values({ userId, recipeId, body })
    .returning({ id: recipeComments.id });

  if (!row) {
    throw new Error("Failed to add comment");
  }

  return row;
}

export async function listCommentsForRecipe(
  recipeId: string,
  limit: number,
  cursor?: string
): Promise<{ items: RecipeCommentRow[]; nextCursor: string | null }> {
  const conditions = [eq(recipeComments.recipeId, recipeId)];

  if (cursor) {
    const cursorDate = new Date(cursor);

    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(recipeComments.createdAt, cursorDate));
    }
  }

  const rows = await db
    .select({
      id: recipeComments.id,
      body: recipeComments.body,
      createdAt: recipeComments.createdAt,
      userId: recipeComments.userId,
      authorHandle: userProfiles.handle,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(recipeComments)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipeComments.userId))
    .where(and(...conditions))
    .orderBy(desc(recipeComments.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

  return { items, nextCursor };
}

export async function countCommentsForRecipe(recipeId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(recipeComments)
    .where(eq(recipeComments.recipeId, recipeId));

  return row?.c ?? 0;
}

/**
 * Returns the comment's recipeId and authorId so the caller can authorise
 * deletion (comment author or recipe owner), or null if it does not exist.
 */
export async function getCommentOwnership(
  commentId: string
): Promise<{ recipeId: string; userId: string } | null> {
  const [row] = await db
    .select({ recipeId: recipeComments.recipeId, userId: recipeComments.userId })
    .from(recipeComments)
    .where(eq(recipeComments.id, commentId))
    .limit(1);

  return row ?? null;
}

export async function deleteComment(commentId: string): Promise<void> {
  await db.delete(recipeComments).where(eq(recipeComments.id, commentId));
}

/**
 * Record a report of a comment. Idempotent per (comment, reporter): reporting
 * again is a no-op. Assumes the comment exists (caller checks ownership first).
 */
export async function reportComment(commentId: string, reporterId: string): Promise<void> {
  await db
    .insert(commentReports)
    .values({ commentId, reporterId })
    .onConflictDoNothing({ target: [commentReports.commentId, commentReports.reporterId] });
}
