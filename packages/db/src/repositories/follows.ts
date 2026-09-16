import { and, desc, eq, lt, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { follows, recipeFavorites, recipes, recipeTags, tags, userProfiles } from "../schema";
import { PRIMARY_IMAGE_SQL } from "./recipe-image-sql";

export async function followUser(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) {
    return;
  }

  await db
    .insert(follows)
    .values({ followerId, followeeId })
    .onConflictDoNothing({ target: [follows.followerId, follows.followeeId] });
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);

  return !!row;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followers] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followeeId, userId));

  const [following] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, userId));

  return { followers: followers?.c ?? 0, following: following?.c ?? 0 };
}

// --- Feed & discovery ---------------------------------------------------

export interface FeedRecipeRow {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  image: string | null;
  dishColor: string | null;
  totalMinutes: number | null;
  publishedAt: Date | null;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  favoriteCount: number;
}

const RECIPE_CARD_COLUMNS = {
  id: recipes.id,
  slug: recipes.slug,
  name: recipes.name,
  description: recipes.description,
  // Serve the primary image (first gallery image, legacy scalar as fallback),
  // exactly like the authed list projections — an imported recipe whose photo
  // only landed in the gallery must still show a thumbnail on public cards.
  image: PRIMARY_IMAGE_SQL,
  dishColor: recipes.dishColor,
  totalMinutes: recipes.totalMinutes,
  publishedAt: recipes.publishedAt,
  authorHandle: userProfiles.handle,
  authorDisplayName: userProfiles.displayName,
  authorAvatarUrl: userProfiles.avatarUrl,
} as const;

const favoriteCountSql = sql<number>`(
  SELECT count(*)::int FROM ${recipeFavorites}
  WHERE ${recipeFavorites.recipeId} = ${recipes.id}
)`;

/**
 * Public recipes authored by people `userId` follows, newest first,
 * cursor-paginated by publishedAt (ISO string cursor).
 */
export async function listFeedRecipes(
  userId: string,
  limit: number,
  cursor?: string
): Promise<{ items: FeedRecipeRow[]; nextCursor: string | null }> {
  const conditions = [
    eq(recipes.visibility, "public"),
    sql`EXISTS (
      SELECT 1 FROM ${follows}
      WHERE ${follows.followerId} = ${userId}
      AND ${follows.followeeId} = ${recipes.userId}
    )`,
  ];

  if (cursor) {
    const cursorDate = new Date(cursor);

    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(recipes.publishedAt, cursorDate));
    }
  }

  const rows = await db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(...conditions))
    .orderBy(desc(recipes.publishedAt))
    .limit(limit + 1);

  return paginateByPublishedAt(rows, limit);
}

type DiscoverSort = "newest" | "trending";

/**
 * Public recipes for the discovery page. `newest` is publishedAt desc
 * (cursor-paginated); `trending` is favourite-count desc (top-N, offset
 * paginated). Optional `category` filters by the recipe category enum.
 */
export async function listDiscoverRecipes(params: {
  sort: DiscoverSort;
  category?: string;
  tag?: string;
  limit: number;
  cursor?: string;
}): Promise<{ items: FeedRecipeRow[]; nextCursor: string | null }> {
  const { sort, category, tag, limit } = params;

  const conditions = [eq(recipes.visibility, "public")];

  if (category) {
    conditions.push(sql`${category} = ANY(${recipes.categories})`);
  }

  if (tag) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id} AND lower(tg.name) = ${tag.trim().toLowerCase()}
    )`);
  }

  if (sort === "trending") {
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;

    const rows = await db
      .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
      .from(recipes)
      .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
      .where(and(...conditions))
      .orderBy(desc(favoriteCountSql), desc(recipes.publishedAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return { items, nextCursor };
  }

  if (params.cursor) {
    const cursorDate = new Date(params.cursor);

    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(recipes.publishedAt, cursorDate));
    }
  }

  const rows = await db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(...conditions))
    .orderBy(desc(recipes.publishedAt))
    .limit(limit + 1);

  return paginateByPublishedAt(rows, limit);
}

/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Full-text-ish search over PUBLIC recipes by name/description, ranked by
 * favourite count then recency. Case-insensitive substring match; not
 * cursor-paginated (top-N results).
 */
export async function searchPublicRecipes(q: string, limit: number): Promise<FeedRecipeRow[]> {
  const pattern = `%${escapeLike(q.trim())}%`;

  return db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(
      and(
        eq(recipes.visibility, "public"),
        sql`(${recipes.name} ILIKE ${pattern} OR ${recipes.description} ILIKE ${pattern})`
      )
    )
    .orderBy(desc(favoriteCountSql), desc(recipes.publishedAt))
    .limit(limit);
}

function paginateByPublishedAt(
  rows: FeedRecipeRow[],
  limit: number
): { items: FeedRecipeRow[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last?.publishedAt ? last.publishedAt.toISOString() : null;

  return { items, nextCursor };
}
