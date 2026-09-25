import { and, desc, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import {
  cuisines,
  follows,
  ingredients,
  recipeCuisines,
  recipeFavorites,
  recipeIngredients,
  recipes,
  recipeTags,
  tags,
  userProfiles,
} from "../schema";
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
  cuisine?: string;
  maxMinutes?: number;
  excludeAllergenTags?: string[];
  limit: number;
  cursor?: string;
}): Promise<{ items: FeedRecipeRow[]; nextCursor: string | null }> {
  const { sort, category, tag, cuisine, maxMinutes, excludeAllergenTags, limit } = params;

  const conditions = [eq(recipes.visibility, "public")];

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
    .where(eq(recipes.visibility, "public"))
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
    .where(eq(recipes.visibility, "public"))
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
    .where(eq(recipes.visibility, "public"))
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
  // reused in WHERE and ORDER BY.
  const matchedCountSql = sql<number>`(${sql.join(
    terms.map(
      (term) =>
        sql`(EXISTS (SELECT 1 FROM ${recipeIngredients}
          JOIN ${ingredients} ON ${ingredients.id} = ${recipeIngredients.ingredientId}
          WHERE ${recipeIngredients.recipeId} = ${recipes.id}
          AND ${ingredients.name} ILIKE ${`%${escapeLike(term)}%`}))::int`
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
    .where(and(eq(recipes.visibility, "public"), sql`${matchedCountSql} > 0`))
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
    .where(eq(recipes.visibility, "public"))
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
