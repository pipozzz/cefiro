import { and, desc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";

import type { RecipeVisibility } from "@norish/shared/contracts/zod/social";

import { db } from "@norish/db/drizzle";

import { recipes, userProfiles } from "../schema";

export interface PublicProfile {
  userId: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
  version: number;
}

export interface UpsertProfileValues {
  handle: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  isPublic?: boolean;
}

export interface PublicRecipeCard {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  image: string | null;
  dishColor: string | null;
  totalMinutes: number | null;
  publishedAt: Date | null;
  visibility: RecipeVisibility;
}

const PROFILE_COLUMNS = {
  userId: userProfiles.userId,
  handle: userProfiles.handle,
  displayName: userProfiles.displayName,
  bio: userProfiles.bio,
  avatarUrl: userProfiles.avatarUrl,
  location: userProfiles.location,
  websiteUrl: userProfiles.websiteUrl,
  isPublic: userProfiles.isPublic,
  createdAt: userProfiles.createdAt,
  version: userProfiles.version,
} as const;

function normalizeEmpty(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

export async function getProfileByUserId(userId: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select(PROFILE_COLUMNS)
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function getProfileByHandle(handle: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select(PROFILE_COLUMNS)
    .from(userProfiles)
    .where(eq(userProfiles.handle, handle.toLowerCase()))
    .limit(1);

  return row ?? null;
}

/**
 * Whether `handle` is free. If `excludeUserId` is given, the caller's own
 * current handle does not count as taken (so re-saving an unchanged profile
 * succeeds).
 */
export async function isHandleAvailable(handle: string, excludeUserId?: string): Promise<boolean> {
  const normalized = handle.toLowerCase();

  const conditions = [eq(userProfiles.handle, normalized)];

  if (excludeUserId) {
    conditions.push(ne(userProfiles.userId, excludeUserId));
  }

  const [row] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(and(...conditions))
    .limit(1);

  return !row;
}

export async function upsertProfile(
  userId: string,
  values: UpsertProfileValues
): Promise<PublicProfile> {
  const payload = {
    handle: values.handle.toLowerCase(),
    displayName: normalizeEmpty(values.displayName),
    bio: normalizeEmpty(values.bio),
    avatarUrl: normalizeEmpty(values.avatarUrl),
    location: normalizeEmpty(values.location),
    websiteUrl: normalizeEmpty(values.websiteUrl),
    ...(values.isPublic === undefined ? {} : { isPublic: values.isPublic }),
  };

  const [row] = await db
    .insert(userProfiles)
    .values({ userId, ...payload })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        ...payload,
        updatedAt: new Date(),
        version: sql`${userProfiles.version} + 1`,
      },
    })
    .returning(PROFILE_COLUMNS);

  if (!row) {
    throw new Error("Failed to upsert user profile");
  }

  return row;
}

// --- Recipe publishing --------------------------------------------------

function slugifyBase(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return base.length > 0 ? base : "recipe";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugifyBase(name);

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;

    const [existing] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.slug, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${randomSuffix()}-${randomSuffix()}`;
}

export interface SetVisibilityResult {
  recipeId: string;
  visibility: RecipeVisibility;
  slug: string | null;
  publishedAt: Date | null;
}

/**
 * Change a recipe's sharing visibility. Only the owner may call this. On the
 * first transition away from `private` a slug and publishedAt are assigned;
 * the slug is kept afterwards so links stay stable even if re-privatised.
 * Returns null if the recipe does not exist or is not owned by `userId`.
 */
export async function setRecipeVisibility(
  userId: string,
  recipeId: string,
  visibility: RecipeVisibility
): Promise<SetVisibilityResult | null> {
  const [current] = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      slug: recipes.slug,
      publishedAt: recipes.publishedAt,
      userId: recipes.userId,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (!current || current.userId !== userId) {
    return null;
  }

  const goingPublic = visibility !== "private";
  const slug = current.slug ?? (goingPublic ? await generateUniqueSlug(current.name) : null);
  const publishedAt = current.publishedAt ?? (goingPublic ? new Date() : null);

  const [updated] = await db
    .update(recipes)
    .set({
      visibility,
      slug,
      publishedAt,
      updatedAt: new Date(),
      version: sql`${recipes.version} + 1`,
    })
    .where(eq(recipes.id, recipeId))
    .returning({
      recipeId: recipes.id,
      visibility: recipes.visibility,
      slug: recipes.slug,
      publishedAt: recipes.publishedAt,
    });

  return updated ?? null;
}

export interface RecipePublishState {
  visibility: RecipeVisibility;
  slug: string | null;
  publishedAt: Date | null;
}

/**
 * The current sharing state of a recipe the caller owns. Returns null if the
 * recipe does not exist or is not owned by `userId`.
 */
export async function getRecipePublishState(
  userId: string,
  recipeId: string
): Promise<RecipePublishState | null> {
  const [row] = await db
    .select({
      visibility: recipes.visibility,
      slug: recipes.slug,
      publishedAt: recipes.publishedAt,
      userId: recipes.userId,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (!row || row.userId !== userId) {
    return null;
  }

  return { visibility: row.visibility, slug: row.slug, publishedAt: row.publishedAt };
}

export interface PublicRecipeRef {
  recipeId: string;
  userId: string | null;
  visibility: RecipeVisibility;
}

/**
 * Resolve a slug to a recipe reference IF it is publicly viewable (public or
 * unlisted). Private recipes and unknown slugs return null. Used by the public
 * recipe page and its media route.
 */
export async function getViewableRecipeRefBySlug(slug: string): Promise<PublicRecipeRef | null> {
  const [row] = await db
    .select({
      recipeId: recipes.id,
      userId: recipes.userId,
      visibility: recipes.visibility,
    })
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  if (!row || row.visibility === "private") {
    return null;
  }

  return row;
}

/**
 * Whether a recipe is viewable by anyone (public or unlisted). Used to gate
 * likes and comments by recipe id.
 */
export async function isRecipeViewableById(recipeId: string): Promise<boolean> {
  const [row] = await db
    .select({ visibility: recipes.visibility })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  return !!row && row.visibility !== "private";
}

/**
 * Viewable-recipe reference by id (public or unlisted), including the owner id
 * so callers can attribute likes/comments (e.g. for notifications). Null when
 * the recipe is missing or private.
 */
export async function getViewableRecipeRefById(recipeId: string): Promise<PublicRecipeRef | null> {
  const [row] = await db
    .select({
      recipeId: recipes.id,
      userId: recipes.userId,
      visibility: recipes.visibility,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (!row || row.visibility === "private") {
    return null;
  }

  return row;
}

/** All PUBLIC recipe slugs (for the sitemap), newest first. */
export async function listPublicRecipeSlugs(
  limit = 50000
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await db
    .select({ slug: recipes.slug, updatedAt: recipes.updatedAt })
    .from(recipes)
    .where(and(eq(recipes.visibility, "public"), isNotNull(recipes.slug)))
    .orderBy(desc(recipes.publishedAt))
    .limit(limit);

  return rows.filter((r): r is { slug: string; updatedAt: Date } => r.slug !== null);
}

/** All PUBLIC profile handles (for the sitemap). */
export async function listPublicProfileHandles(
  limit = 50000
): Promise<Array<{ handle: string; updatedAt: Date }>> {
  return db
    .select({ handle: userProfiles.handle, updatedAt: userProfiles.updatedAt })
    .from(userProfiles)
    .where(eq(userProfiles.isPublic, true))
    .orderBy(desc(userProfiles.updatedAt))
    .limit(limit);
}

/**
 * List a user's PUBLIC recipes (excludes unlisted/private), newest first,
 * cursor-paginated by publishedAt. Cursor is an ISO timestamp.
 */
export async function listPublicRecipesByUserId(
  userId: string,
  limit: number,
  cursor?: string
): Promise<{ items: PublicRecipeCard[]; nextCursor: string | null }> {
  const conditions = [eq(recipes.userId, userId), eq(recipes.visibility, "public")];

  if (cursor) {
    const cursorDate = new Date(cursor);

    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(recipes.publishedAt, cursorDate));
    }
  }

  const rows = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      name: recipes.name,
      description: recipes.description,
      image: recipes.image,
      dishColor: recipes.dishColor,
      totalMinutes: recipes.totalMinutes,
      publishedAt: recipes.publishedAt,
      visibility: recipes.visibility,
    })
    .from(recipes)
    .where(and(...conditions))
    .orderBy(desc(recipes.publishedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last?.publishedAt ? last.publishedAt.toISOString() : null;

  return { items, nextCursor };
}
