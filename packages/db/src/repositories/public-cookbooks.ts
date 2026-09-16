import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";

import type { RecipeVisibility } from "@norish/shared/contracts/zod/social";
import { db } from "@norish/db/drizzle";

import type { FeedRecipeRow } from "./follows";
import { cookbookRecipes, cookbooks, recipeFavorites, recipes, userProfiles } from "../schema";
import { PRIMARY_IMAGE_SQL } from "./recipe-image-sql";

// --- Slug ----------------------------------------------------------------

function slugifyBase(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return base.length > 0 ? base : "cookbook";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugifyBase(title);

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const [existing] = await db
      .select({ id: cookbooks.id })
      .from(cookbooks)
      .where(eq(cookbooks.slug, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${randomSuffix()}-${randomSuffix()}`;
}

// --- Owner-side publishing -----------------------------------------------

export interface CookbookPublishState {
  visibility: RecipeVisibility;
  slug: string | null;
  description: string | null;
}

/**
 * The sharing state of a cookbook the caller owns, or null if it does not
 * exist or is not owned by `userId`.
 */
export async function getCookbookPublishState(
  userId: string,
  cookbookId: string
): Promise<CookbookPublishState | null> {
  const [row] = await db
    .select({
      visibility: cookbooks.visibility,
      slug: cookbooks.slug,
      description: cookbooks.description,
      userId: cookbooks.userId,
    })
    .from(cookbooks)
    .where(eq(cookbooks.id, cookbookId))
    .limit(1);

  if (!row || row.userId !== userId) {
    return null;
  }

  return { visibility: row.visibility, slug: row.slug, description: row.description };
}

/**
 * Change a cookbook's sharing visibility. Only the owner may call this. On the
 * first transition away from `private` a slug is assigned and kept afterwards,
 * so a link stays stable even if the cookbook is re-privatised. Returns null if
 * the cookbook does not exist or is not owned by `userId`.
 */
export async function setCookbookVisibility(
  userId: string,
  cookbookId: string,
  visibility: RecipeVisibility
): Promise<CookbookPublishState | null> {
  const [current] = await db
    .select({
      id: cookbooks.id,
      title: cookbooks.title,
      slug: cookbooks.slug,
      userId: cookbooks.userId,
    })
    .from(cookbooks)
    .where(eq(cookbooks.id, cookbookId))
    .limit(1);

  if (!current || current.userId !== userId) {
    return null;
  }

  const goingPublic = visibility !== "private";
  const slug = current.slug ?? (goingPublic ? await generateUniqueSlug(current.title) : null);

  const [updated] = await db
    .update(cookbooks)
    .set({ visibility, slug, updatedAt: new Date(), version: sql`${cookbooks.version} + 1` })
    .where(eq(cookbooks.id, cookbookId))
    .returning({
      visibility: cookbooks.visibility,
      slug: cookbooks.slug,
      description: cookbooks.description,
    });

  return updated ?? null;
}

/** Set a cookbook's public description (owner only). Returns false if not owned. */
export async function setCookbookDescription(
  userId: string,
  cookbookId: string,
  description: string | null
): Promise<boolean> {
  const result = await db
    .update(cookbooks)
    .set({ description, updatedAt: new Date(), version: sql`${cookbooks.version} + 1` })
    .where(and(eq(cookbooks.id, cookbookId), eq(cookbooks.userId, userId)))
    .returning({ id: cookbooks.id });

  return result.length > 0;
}

// --- Public reads --------------------------------------------------------

const RECIPE_CARD_COLUMNS = {
  id: recipes.id,
  slug: recipes.slug,
  name: recipes.name,
  description: recipes.description,
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

export interface PublicCookbook {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  owner: { handle: string; displayName: string | null; avatarUrl: string | null } | null;
  recipes: FeedRecipeRow[];
}

/**
 * A public (or unlisted) cookbook by slug, with only the PUBLIC recipes filed
 * in it — a private recipe stays private even inside a shared cookbook. Null
 * when the slug is missing or the cookbook is private.
 */
export async function getPublicCookbookBySlug(slug: string): Promise<PublicCookbook | null> {
  const [cb] = await db
    .select({
      id: cookbooks.id,
      userId: cookbooks.userId,
      title: cookbooks.title,
      description: cookbooks.description,
      visibility: cookbooks.visibility,
      slug: cookbooks.slug,
    })
    .from(cookbooks)
    .where(eq(cookbooks.slug, slug))
    .limit(1);

  if (!cb || !cb.slug || cb.visibility === "private") {
    return null;
  }

  let owner: PublicCookbook["owner"] = null;

  if (cb.userId) {
    const [profile] = await db
      .select({
        handle: userProfiles.handle,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        isPublic: userProfiles.isPublic,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, cb.userId))
      .limit(1);

    if (profile?.isPublic) {
      owner = {
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      };
    }
  }

  const recipeRows = await db
    .select({ ...RECIPE_CARD_COLUMNS, favoriteCount: favoriteCountSql })
    .from(cookbookRecipes)
    .innerJoin(recipes, eq(recipes.id, cookbookRecipes.recipeId))
    .leftJoin(userProfiles, eq(userProfiles.userId, recipes.userId))
    .where(and(eq(cookbookRecipes.cookbookId, cb.id), eq(recipes.visibility, "public")))
    .orderBy(desc(recipes.publishedAt));

  return {
    id: cb.id,
    slug: cb.slug,
    title: cb.title,
    description: cb.description,
    owner,
    recipes: recipeRows,
  };
}

export interface CookbookCover {
  /** Owner-scoped image path; the caller rewrites it to the public media URL. */
  image: string;
  /** The recipe's public slug, needed to build that URL. */
  recipeSlug: string | null;
}

export interface PublicCookbookCard {
  slug: string;
  title: string;
  description: string | null;
  recipeCount: number;
  coverImages: CookbookCover[];
}

/** A user's public (and unlisted) cookbooks, for their profile. */
export async function listPublicCookbooksByUserId(userId: string): Promise<PublicCookbookCard[]> {
  const rows = await db
    .select({
      id: cookbooks.id,
      slug: cookbooks.slug,
      title: cookbooks.title,
      description: cookbooks.description,
    })
    .from(cookbooks)
    .where(
      and(
        eq(cookbooks.userId, userId),
        ne(cookbooks.visibility, "private"),
        isNotNull(cookbooks.slug)
      )
    )
    .orderBy(desc(cookbooks.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((r) => r.id);

  // Public members of every listed cookbook in one pass; grouped in JS into a
  // count and up to four cover images each.
  const members = await db
    .select({
      cookbookId: cookbookRecipes.cookbookId,
      image: PRIMARY_IMAGE_SQL,
      recipeSlug: recipes.slug,
      publishedAt: recipes.publishedAt,
    })
    .from(cookbookRecipes)
    .innerJoin(recipes, eq(recipes.id, cookbookRecipes.recipeId))
    .where(and(inArray(cookbookRecipes.cookbookId, ids), eq(recipes.visibility, "public")))
    .orderBy(desc(recipes.publishedAt));

  const byCookbook = new Map<string, { count: number; covers: CookbookCover[] }>();

  for (const m of members) {
    const entry = byCookbook.get(m.cookbookId) ?? { count: 0, covers: [] };

    entry.count += 1;

    if (m.image && entry.covers.length < 4) {
      entry.covers.push({ image: m.image, recipeSlug: m.recipeSlug });
    }

    byCookbook.set(m.cookbookId, entry);
  }

  return rows
    .filter((r): r is typeof r & { slug: string } => r.slug !== null)
    .map((r) => {
      const agg = byCookbook.get(r.id) ?? { count: 0, covers: [] };

      return {
        slug: r.slug,
        title: r.title,
        description: r.description,
        recipeCount: agg.count,
        coverImages: agg.covers,
      };
    });
}

/** All PUBLIC cookbook slugs (for the sitemap), newest first. */
export async function listPublicCookbookSlugs(
  limit = 50000
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await db
    .select({ slug: cookbooks.slug, updatedAt: cookbooks.updatedAt })
    .from(cookbooks)
    .where(and(eq(cookbooks.visibility, "public"), isNotNull(cookbooks.slug)))
    .orderBy(desc(cookbooks.updatedAt))
    .limit(limit);

  return rows.filter((r): r is { slug: string; updatedAt: Date } => r.slug !== null);
}
