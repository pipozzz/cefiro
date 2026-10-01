import { and, desc, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import {
  cuisines,
  follows,
  ingredients,
  recipeCuisines,
  recipeEmbeddings,
  recipeFavorites,
  recipeIngredients,
  recipes,
  recipeTags,
  tags,
  userProfiles,
} from "../schema";
import { PRIMARY_IMAGE_SQL } from "./recipe-image-sql";

export type FollowStatus = "pending" | "accepted";
/** The viewer's edge to a followee: none, a pending request, or an active follow. */
export type FollowRelation = "none" | "pending" | "accepted";

/**
 * Create (or keep) a follow edge with the given status and return the effective
 * relation. `accepted` is an immediate follow (public target); `pending` is a
 * request awaiting approval (private target). An existing edge is never
 * downgraded or duplicated — its current status is returned unchanged.
 */
export async function followUser(
  followerId: string,
  followeeId: string,
  status: FollowStatus = "accepted"
): Promise<FollowRelation> {
  if (followerId === followeeId) {
    return "none";
  }

  await db
    .insert(follows)
    .values({ followerId, followeeId, status })
    .onConflictDoNothing({ target: [follows.followerId, follows.followeeId] });

  return getFollowRelation(followerId, followeeId);
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

/** The follower's current relation to the followee (accepted / pending / none). */
export async function getFollowRelation(
  followerId: string,
  followeeId: string
): Promise<FollowRelation> {
  const [row] = await db
    .select({ status: follows.status })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);

  return row ? (row.status as FollowStatus) : "none";
}

/** True only for an ACTIVE (accepted) follow. */
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  return (await getFollowRelation(followerId, followeeId)) === "accepted";
}

/** Approve a pending request (followee approves follower). Returns whether one existed. */
export async function acceptFollowRequest(
  followeeId: string,
  followerId: string
): Promise<boolean> {
  const updated = await db
    .update(follows)
    .set({ status: "accepted" })
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followeeId, followeeId),
        eq(follows.status, "pending")
      )
    )
    .returning({ id: follows.id });

  return updated.length > 0;
}

/** Decline (delete) a pending request. Returns whether one existed. */
export async function declineFollowRequest(
  followeeId: string,
  followerId: string
): Promise<boolean> {
  const deleted = await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followeeId, followeeId),
        eq(follows.status, "pending")
      )
    )
    .returning({ id: follows.id });

  return deleted.length > 0;
}

export interface FollowRequestCard {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  requestedAt: Date;
}

/** Pending follow requests awaiting `followeeId`'s approval, newest first. */
export async function listPendingFollowRequests(
  followeeId: string,
  limit = 100
): Promise<FollowRequestCard[]> {
  return db
    .select({
      handle: userProfiles.handle,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      requestedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(userProfiles, eq(userProfiles.userId, follows.followerId))
    .where(and(eq(follows.followeeId, followeeId), eq(follows.status, "pending")))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
}

/** How many pending follow requests `followeeId` has (for the inbox badge). */
export async function countPendingFollowRequests(followeeId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(follows)
    .where(and(eq(follows.followeeId, followeeId), eq(follows.status, "pending")));

  return row?.c ?? 0;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  // Only active (accepted) edges count; pending requests are not followers yet.
  const [followers] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(follows)
    .where(and(eq(follows.followeeId, userId), eq(follows.status, "accepted")));

  const [following] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.status, "accepted")));

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
  servings: number | null;
  originCountry: string | null;
  tags: string[];
}

/**
 * The public recipe-card projection, shared by every discovery surface AND the
 * public cookbook view — one definition so a new card field (servings, tags, …)
 * never lands on some surfaces and silently misses others.
 */
export const RECIPE_CARD_COLUMNS = {
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
  // Servings, origin flag and tag names so a public card matches the Library
  // dashboard card (servings pill, origin flag, tag overlay).
  servings: recipes.servings,
  originCountry: recipes.originCountry,
  tags: sql<string[]>`(
    SELECT coalesce(array_agg(tg.name ORDER BY rt."order"), '{}')
    FROM ${recipeTags} rt
    JOIN ${tags} tg ON tg.id = rt.tag_id
    WHERE rt.recipe_id = ${recipes.id}
  )`,
} as const;

const favoriteCountSql = sql<number>`(
  SELECT count(*)::int FROM ${recipeFavorites}
  WHERE ${recipeFavorites.recipeId} = ${recipes.id}
)`;

/**
 * A recipe whose author has NOT set their profile private. Private cooks are
 * not *broadcast* (v3): their recipes are excluded from discovery, search,
 * trending and the sitemap — but a recipe stays reachable by its direct
 * `/r/[slug]` link, and an approved follower still sees it (feed / for-you).
 * Authors without a profile row (NULL) are treated as public, so nothing that
 * shows today disappears except explicitly-private accounts.
 */
export const authorNotPrivateSql = sql`NOT EXISTS (
  SELECT 1 FROM ${userProfiles}
  WHERE ${userProfiles.userId} = ${recipes.userId}
  AND ${userProfiles.isPublic} = false
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
      AND ${follows.status} = 'accepted'
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

/**
 * The personalised "For you" feed: every public recipe, ranked so the cooks the
 * reader follows come first (their most-loved, newest), then the best of the
 * wider community. Recipes tagged with the reader's own allergens are dropped.
 *
 * It deliberately does NOT exclude the reader's own public recipes: on a young
 * platform the reader may be the author of most public content, and excluding
 * their recipes would leave the feed empty — the opposite of the goal. Their
 * public recipes are community content like any other here. Offset-paginated on
 * a deterministic ordering, so with no follows it degrades gracefully to the
 * community's newest, dietary-filtered recipes.
 */
export async function listForYouRecipes(params: {
  userId: string;
  excludeAllergenTags?: string[];
  limit: number;
  cursor?: string;
}): Promise<{ items: FeedRecipeRow[]; nextCursor: string | null }> {
  const { userId, excludeAllergenTags, limit } = params;
  const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;

  // Is this recipe's author someone the reader follows? Drives the primary sort
  // key, so a followed cook's recipes rank ahead of the community tail.
  const isFollowedSql = sql<boolean>`EXISTS (
    SELECT 1 FROM ${follows}
    WHERE ${follows.followerId} = ${userId}
    AND ${follows.followeeId} = ${recipes.userId}
    AND ${follows.status} = 'accepted'
  )`;

  // A private cook is not broadcast in the community tail — but an approved
  // follower still sees them (they're a followed edge), so allow either.
  const conditions = [
    eq(recipes.visibility, "public"),
    sql`(${authorNotPrivateSql} OR ${isFollowedSql})`,
  ];

  // Dietary-aware: drop recipes tagged with any of the reader's allergen tags
  // (case-insensitive name match, mirroring listDiscoverRecipes).
  const allergens = (excludeAllergenTags ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (allergens.length > 0) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id}
      AND lower(tg.name) IN (${sql.join(
        allergens.map((name) => sql`${name}`),
        sql`, `
      )})
    )`);
  }

  const rows = await db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(...conditions))
    .orderBy(desc(isFollowedSql), desc(favoriteCountSql), desc(recipes.publishedAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return { items, nextCursor };
}

/**
 * The taste-personalised "For you" feed: the same feed as `listForYouRecipes`,
 * but ordered by how close each recipe is (in embedding space) to the reader's
 * taste vector — the mean of what they have favourited. Recipes from cooks they
 * follow still come first; within each block the nearest-in-meaning recipes lead,
 * then favourites, then recency.
 *
 * A LEFT JOIN keeps recipes that carry no embedding yet (they sort last, after
 * everything with a distance), so a partly-backfilled catalogue never hides
 * content. Offset-paginated on a deterministic ordering. The caller falls back
 * to `listForYouRecipes` when the reader has no taste vector (no favourites).
 */
export async function listForYouByTaste(params: {
  userId: string;
  tasteVector: number[];
  excludeAllergenTags?: string[];
  limit: number;
  cursor?: string;
}): Promise<{ items: FeedRecipeRow[]; nextCursor: string | null }> {
  const { userId, tasteVector, excludeAllergenTags, limit } = params;
  const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;
  const vec = `[${tasteVector.join(",")}]`;

  const isFollowedSql = sql<boolean>`EXISTS (
    SELECT 1 FROM ${follows}
    WHERE ${follows.followerId} = ${userId}
    AND ${follows.followeeId} = ${recipes.userId}
    AND ${follows.status} = 'accepted'
  )`;
  // Cosine distance to the taste vector; NULL for a recipe with no embedding.
  const distanceSql = sql<number | null>`(${recipeEmbeddings.embedding} <=> ${vec}::vector)`;

  // A private cook is not broadcast — but an approved follower still sees them.
  const conditions = [
    eq(recipes.visibility, "public"),
    sql`(${authorNotPrivateSql} OR ${isFollowedSql})`,
  ];

  const allergens = (excludeAllergenTags ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (allergens.length > 0) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id}
      AND lower(tg.name) IN (${sql.join(
        allergens.map((name) => sql`${name}`),
        sql`, `
      )})
    )`);
  }

  const rows = await db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .leftJoin(recipeEmbeddings, eq(recipeEmbeddings.recipeId, recipes.id))
    .where(and(...conditions))
    .orderBy(
      desc(isFollowedSql),
      sql`${distanceSql} ASC NULLS LAST`,
      desc(favoriteCountSql),
      desc(recipes.publishedAt)
    )
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : null;

  return { items, nextCursor };
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
  cuisine?: string;
  maxMinutes?: number;
  excludeAllergenTags?: string[];
  limit: number;
  cursor?: string;
}): Promise<{ items: FeedRecipeRow[]; nextCursor: string | null }> {
  const { sort, category, tag, cuisine, maxMinutes, excludeAllergenTags, limit } = params;

  const conditions = [eq(recipes.visibility, "public"), authorNotPrivateSql];

  if (category) {
    conditions.push(sql`${category} = ANY(${recipes.categories})`);
  }

  // "Ready in ≤N minutes". Recipes without a stated total time are excluded
  // (lte on NULL is false) — we can't promise a time we don't know.
  if (maxMinutes) {
    conditions.push(lte(recipes.totalMinutes, maxMinutes));
  }

  // Dietary-aware discovery: drop recipes tagged with any of the reader's
  // allergen tags (case-insensitive name match, mirroring isAllergenTag).
  const allergens = (excludeAllergenTags ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (allergens.length > 0) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id}
      AND lower(tg.name) IN (${sql.join(
        allergens.map((name) => sql`${name}`),
        sql`, `
      )})
    )`);
  }

  if (tag) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id} AND lower(tg.name) = ${tag.trim().toLowerCase()}
    )`);
  }

  if (cuisine) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${recipeCuisines} rc
      JOIN ${cuisines} cu ON cu.id = rc.cuisine_id
      WHERE rc.recipe_id = ${recipes.id} AND lower(cu.name) = ${cuisine.trim().toLowerCase()}
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

/**
 * A simple discovery facet: how many PUBLIC recipes fall in each meal category,
 * plus the total, under the reader's current non-category filters (tag, "ready
 * in" time, dietary allergens). Powers the counts shown on the category chips so
 * a reader sees where the recipes are before narrowing. One row, four filtered
 * counts — categories is a text[] so a recipe counts in each of its categories.
 */
export async function countPublicRecipesByCategory(params: {
  tag?: string;
  maxMinutes?: number;
  excludeAllergenTags?: string[];
}): Promise<{ total: number; byCategory: Record<string, number> }> {
  const conditions = [eq(recipes.visibility, "public"), authorNotPrivateSql];

  if (params.maxMinutes) {
    conditions.push(lte(recipes.totalMinutes, params.maxMinutes));
  }

  const allergens = (params.excludeAllergenTags ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (allergens.length > 0) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id}
      AND lower(tg.name) IN (${sql.join(
        allergens.map((name) => sql`${name}`),
        sql`, `
      )})
    )`);
  }

  if (params.tag) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id} AND lower(tg.name) = ${params.tag.trim().toLowerCase()}
    )`);
  }

  const [row] = await db
    .select({
      breakfast: sql<number>`count(*) FILTER (WHERE 'Breakfast' = ANY(${recipes.categories}))::int`,
      lunch: sql<number>`count(*) FILTER (WHERE 'Lunch' = ANY(${recipes.categories}))::int`,
      dinner: sql<number>`count(*) FILTER (WHERE 'Dinner' = ANY(${recipes.categories}))::int`,
      snack: sql<number>`count(*) FILTER (WHERE 'Snack' = ANY(${recipes.categories}))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .where(and(...conditions));

  return {
    total: Number(row?.total ?? 0),
    byCategory: {
      Breakfast: Number(row?.breakfast ?? 0),
      Lunch: Number(row?.lunch ?? 0),
      Dinner: Number(row?.dinner ?? 0),
      Snack: Number(row?.snack ?? 0),
    },
  };
}

/**
 * Cuisine discovery facet: how many PUBLIC recipes carry each cuisine, plus the
 * total, under the reader's current non-cuisine filters (tag, "ready in" time,
 * dietary allergens). Powers the counts on the cuisine chips.
 *
 * Cuisine is an admin-owned vocabulary joined through recipe_cuisines, so —
 * unlike the fixed category text[] — this GROUPs BY cuisine name over the join
 * (mirroring listPublicCuisines). `total` is the distinct public recipes matching
 * the shared filters: it comes from its own count, not the sum of the map, since a
 * recipe with several cuisines (or none) would otherwise miscount.
 */
export async function countPublicRecipesByCuisine(params: {
  tag?: string;
  maxMinutes?: number;
  excludeAllergenTags?: string[];
}): Promise<{ total: number; byCuisine: Record<string, number> }> {
  const conditions = [eq(recipes.visibility, "public"), authorNotPrivateSql];

  if (params.maxMinutes) {
    conditions.push(lte(recipes.totalMinutes, params.maxMinutes));
  }

  const allergens = (params.excludeAllergenTags ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (allergens.length > 0) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id}
      AND lower(tg.name) IN (${sql.join(
        allergens.map((name) => sql`${name}`),
        sql`, `
      )})
    )`);
  }

  if (params.tag) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${recipeTags} rt
      JOIN ${tags} tg ON tg.id = rt.tag_id
      WHERE rt.recipe_id = ${recipes.id} AND lower(tg.name) = ${params.tag.trim().toLowerCase()}
    )`);
  }

  const cuisineCountSql = sql<number>`count(distinct ${recipeCuisines.recipeId})::int`;

  const [rows, totalRows] = await Promise.all([
    db
      .select({ name: cuisines.name, count: cuisineCountSql })
      .from(recipes)
      .innerJoin(recipeCuisines, eq(recipeCuisines.recipeId, recipes.id))
      .innerJoin(cuisines, eq(cuisines.id, recipeCuisines.cuisineId))
      .where(and(...conditions))
      .groupBy(cuisines.name)
      .orderBy(desc(cuisineCountSql), cuisines.name),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(recipes)
      .where(and(...conditions)),
  ]);

  const byCuisine: Record<string, number> = {};

  for (const row of rows) {
    byCuisine[row.name] = Number(row.count ?? 0);
  }

  return { total: Number(totalRows[0]?.total ?? 0), byCuisine };
}

/**
 * Trending discovery topics: the tags used by the most PUBLIC recipes, most
 * used first (ties broken alphabetically for a stable order). Powers the
 * clickable topic chips on /discover, which drive the existing tag filter.
 */
export async function listTrendingTopics(
  limit: number
): Promise<{ name: string; recipeCount: number }[]> {
  const recipeCount = sql<number>`count(distinct ${recipeTags.recipeId})`;

  const rows = await db
    .select({ name: tags.name, recipeCount })
    .from(recipeTags)
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
    .where(and(eq(recipes.visibility, "public"), authorNotPrivateSql))
    .groupBy(tags.name)
    .orderBy(desc(recipeCount), tags.name)
    .limit(limit);

  return rows.map((row) => ({ name: row.name, recipeCount: Number(row.recipeCount) }));
}

/**
 * Discover themes: the top public tags with a count, each carrying one
 * representative recipe (newest public one with a photo) so the discover
 * theme tiles can show a real image. `slug` + `image` are owner-scoped; the
 * caller rewrites `image` to the public slug-scoped media URL.
 */
export async function listDiscoverThemes(
  limit: number
): Promise<{ name: string; recipeCount: number; slug: string | null; image: string | null }[]> {
  const recipeCount = sql<number>`count(distinct ${recipeTags.recipeId})`;

  const topRows = await db
    .select({ name: tags.name, recipeCount })
    .from(recipeTags)
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
    .where(and(eq(recipes.visibility, "public"), authorNotPrivateSql))
    .groupBy(tags.name)
    .orderBy(desc(recipeCount), tags.name)
    .limit(limit);

  const names = topRows.map((row) => row.name);
  const sampleByTag = new Map<string, { slug: string | null; image: string | null }>();

  if (names.length > 0) {
    // One representative recipe per tag: DISTINCT ON (tag) with the tag as the
    // first ORDER BY key (Postgres requirement), then newest first.
    const samples = await db
      .selectDistinctOn([tags.name], {
        name: tags.name,
        slug: recipes.slug,
        image: recipes.image,
      })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
      .where(
        and(
          eq(recipes.visibility, "public"),
          authorNotPrivateSql,
          inArray(tags.name, names),
          isNotNull(recipes.image),
          isNotNull(recipes.slug)
        )
      )
      .orderBy(tags.name, desc(recipes.createdAt));

    for (const sample of samples) {
      sampleByTag.set(sample.name, { slug: sample.slug, image: sample.image });
    }
  }

  return topRows.map((row) => ({
    name: row.name,
    recipeCount: Number(row.recipeCount),
    slug: sampleByTag.get(row.name)?.slug ?? null,
    image: sampleByTag.get(row.name)?.image ?? null,
  }));
}

/**
 * "Recipe of the day": one PUBLIC recipe chosen deterministically per calendar
 * day (a hash of id + today's date), so every visitor sees the same pick and it
 * rotates once a day. Returns null when there are no public recipes.
 */
export async function getRecipeOfTheDay(): Promise<FeedRecipeRow | null> {
  const [row] = await db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(eq(recipes.visibility, "public"), authorNotPrivateSql))
    .orderBy(sql`md5(${recipes.id}::text || current_date::text)`)
    .limit(1);

  return row ?? null;
}

/**
 * "More like this": other PUBLIC recipes that share the most tags with the
 * given recipe, ranked by shared-tag count then favourites then recency. The
 * recipe itself is excluded, and only recipes sharing ≥1 tag are returned (so
 * an untagged recipe yields nothing rather than a random list).
 */
export async function listRelatedPublicRecipes(
  recipeId: string,
  limit: number
): Promise<FeedRecipeRow[]> {
  const sharedTagCount = sql<number>`(
    SELECT count(*)::int FROM ${recipeTags} rt
    WHERE rt.recipe_id = ${recipes.id}
    AND rt.tag_id IN (
      SELECT tag_id FROM ${recipeTags} WHERE recipe_id = ${recipeId}::uuid
    )
  )`;

  return db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(
      and(
        eq(recipes.visibility, "public"),
        authorNotPrivateSql,
        sql`${recipes.id} <> ${recipeId}::uuid`,
        sql`${sharedTagCount} > 0`
      )
    )
    .orderBy(desc(sharedTagCount), desc(favoriteCountSql), desc(recipes.publishedAt))
    .limit(limit);
}

/**
 * Distinct ingredient names for each of the given recipes, keyed by recipeId.
 * Names are deduped case-insensitively (a recipe stored in two measurement
 * systems repeats the same ingredient name). Used to work out, for a
 * cook-with-what-you-have search, which of a recipe's ingredients the reader is
 * still missing.
 */
export async function getRecipeIngredientNamesByRecipeIds(
  recipeIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  if (recipeIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({ recipeId: recipeIngredients.recipeId, name: ingredients.name })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(inArray(recipeIngredients.recipeId, recipeIds));

  for (const row of rows) {
    const name = (row.name ?? "").trim();

    if (!name) {
      continue;
    }

    const list = result.get(row.recipeId) ?? [];

    if (!list.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      list.push(name);
    }

    result.set(row.recipeId, list);
  }

  return result;
}

/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Full-text search over PUBLIC recipes by name/description, ranked by relevance
 * then favourites then recency. Postgres FTS on the `simple` config with
 * `f_unaccent` on both sides, so it is diacritics-insensitive (a search for
 * "strudla" finds "štrúdľa") — important for Slovak. Each word becomes a prefix
 * term (`:*`) so it matches as the reader types ("kur" finds "kuracie"). Backed
 * by the `idx_recipes_fts` GIN index (migration 0070). Top-N, not paginated.
 */
export async function searchPublicRecipes(q: string, limit: number): Promise<FeedRecipeRow[]> {
  const trimmed = q.trim();

  if (!trimmed) {
    return [];
  }

  // Build a prefix AND-query from the sanitized words. Words are lowercased,
  // unaccented and stripped to [a-z0-9] so arbitrary input can never form an
  // invalid tsquery; when nothing survives, the query is NULL and matches
  // nothing (an honest empty result).
  const tsquery = sql`to_tsquery('simple', (
    SELECT string_agg(w || ':*', ' & ')
    FROM (
      SELECT regexp_replace(f_unaccent(lower(word)), '[^a-z0-9]', '', 'g') AS w
      FROM unnest(regexp_split_to_array(${trimmed}, '[[:space:]]+')) AS word
    ) t
    WHERE w <> ''
  ))`;
  // Must match the index expression in migration 0070 exactly to use the index.
  const document = sql`to_tsvector('simple', f_unaccent(coalesce(${recipes.name}, '') || ' ' || coalesce(${recipes.description}, '')))`;
  const rank = sql<number>`ts_rank(${document}, ${tsquery})`;

  return db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(
      and(eq(recipes.visibility, "public"), authorNotPrivateSql, sql`${document} @@ ${tsquery}`)
    )
    .orderBy(desc(rank), desc(favoriteCountSql), desc(recipes.publishedAt))
    .limit(limit);
}

/**
 * "Cook with what you have": PUBLIC recipes ranked by how many of the given
 * ingredient terms they use. `matchedCount` is the number of distinct input
 * terms that match at least one of the recipe's ingredients (case-insensitive
 * substring), so a recipe using more of your ingredients ranks higher; ties
 * break on favourites then recency. Only recipes matching ≥1 term are returned.
 */
export async function searchPublicRecipesByIngredients(
  ingredientNames: string[],
  limit: number
): Promise<(FeedRecipeRow & { matchedCount: number })[]> {
  const terms = Array.from(
    new Set(ingredientNames.map((s) => s.trim().toLowerCase()).filter(Boolean))
  ).slice(0, 10);

  if (terms.length === 0) {
    return [];
  }

  // One correlated EXISTS per term, summed → how many of the caller's
  // ingredients this recipe uses. Inlined (not a SELECT alias) so it can be
  // reused in WHERE and ORDER BY. `f_unaccent` on both sides makes the match
  // diacritics-insensitive, so "ryza" finds "ryža" (and vice versa) — mirroring
  // the recipe full-text search.
  const matchedCountSql = sql<number>`(${sql.join(
    terms.map(
      (term) =>
        sql`(EXISTS (SELECT 1 FROM ${recipeIngredients}
          JOIN ${ingredients} ON ${ingredients.id} = ${recipeIngredients.ingredientId}
          WHERE ${recipeIngredients.recipeId} = ${recipes.id}
          AND f_unaccent(${ingredients.name}) ILIKE f_unaccent(${`%${escapeLike(term)}%`})))::int`
    ),
    sql` + `
  )})`;

  return db
    .select({
      ...RECIPE_CARD_COLUMNS,
      favoriteCount: favoriteCountSql,
      matchedCount: matchedCountSql,
    })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(eq(recipes.visibility, "public"), authorNotPrivateSql, sql`${matchedCountSql} > 0`))
    .orderBy(desc(matchedCountSql), desc(favoriteCountSql), desc(recipes.publishedAt))
    .limit(limit);
}

/**
 * "Surprise me": a random handful of PUBLIC recipes. Each call reshuffles
 * (ORDER BY random()), so refetching serves a fresh set — the basis for the
 * shuffle button on /discover.
 */
export async function getRandomPublicRecipes(limit: number): Promise<FeedRecipeRow[]> {
  return db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(eq(recipes.visibility, "public"), authorNotPrivateSql))
    .orderBy(sql`random()`)
    .limit(limit);
}

/**
 * Public recipe cards for a set of ids, as feed rows. Order is NOT preserved —
 * a `WHERE id IN (…)` returns rows in storage order — so a caller that needs a
 * specific order (e.g. semantic-similarity ranking) reorders by id itself.
 * Non-public or missing ids are silently dropped.
 */
export async function getPublicRecipesByIds(ids: string[]): Promise<FeedRecipeRow[]> {
  if (ids.length === 0) return [];

  return db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(recipes)
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(eq(recipes.visibility, "public"), inArray(recipes.id, ids)));
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
