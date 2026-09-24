import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { recipes, recipeTags, tags, themes } from "../schema";

/** One theme row as the clustering job produces it (no id/updatedAt yet). */
export interface ThemeInput {
  name: string;
  recipeCount: number;
  centroid: number[];
  representativeRecipeId: string | null;
  slug: string | null;
  image: string | null;
  rank: number;
}

/** A theme as discovery reads it. */
export interface ThemeRow {
  id: string;
  name: string;
  recipeCount: number;
  centroid: number[];
  representativeRecipeId: string | null;
  slug: string | null;
  image: string | null;
  rank: number;
}

/**
 * Replace the whole themes table with a fresh clustering run, atomically. An
 * empty input clears it (e.g. the catalogue shrank below the clustering floor),
 * which is a valid outcome, not a no-op.
 */
export async function replaceThemes(rows: ThemeInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(themes);

    if (rows.length > 0) {
      await tx.insert(themes).values(rows);
    }
  });
}

/** Themes for discovery, largest cluster first. */
export async function listThemes(limit: number): Promise<ThemeRow[]> {
  return db.select().from(themes).orderBy(themes.rank).limit(limit);
}

/** One theme by id — its centroid drives the similarity search behind a tile. */
export async function getThemeById(id: string): Promise<ThemeRow | null> {
  const [row] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);

  return row ?? null;
}

/** Names of the given recipes, keyed by id — for building a cluster's titles. */
export async function getRecipeNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(inArray(recipes.id, ids));

  return new Map(rows.map((row) => [row.id, row.name]));
}

/** A recipe's tile fields (name, slug, primary image path). */
export async function getRecipeDisplayById(
  id: string
): Promise<{ name: string; slug: string | null; image: string | null } | null> {
  const [row] = await db
    .select({ name: recipes.name, slug: recipes.slug, image: recipes.image })
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  return row ?? null;
}

/**
 * The most common tag names across a set of recipes, most frequent first. Gives
 * the clustering job a derived label when AI naming is unavailable, and extra
 * signal for the namer when it is.
 */
export async function getTopTagsForRecipeIds(ids: string[], limit: number): Promise<string[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select({ name: tags.name, count: sql<number>`count(*)` })
    .from(recipeTags)
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(inArray(recipeTags.recipeId, ids))
    .groupBy(tags.name)
    .orderBy(desc(sql`count(*)`), tags.name)
    .limit(limit);

  return rows.map((row) => row.name);
}
