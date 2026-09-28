import { desc, eq, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { recipeEmbeddings, recipeFavorites, recipes } from "../schema";

/** pgvector literal for a JS number array, e.g. [1,2,3] → "[1,2,3]". */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/** Store (or replace) a recipe's embedding. */
export async function upsertRecipeEmbedding(params: {
  recipeId: string;
  embedding: number[];
  model: string;
  contentHash: string;
}): Promise<void> {
  await db
    .insert(recipeEmbeddings)
    .values({
      recipeId: params.recipeId,
      embedding: params.embedding,
      model: params.model,
      contentHash: params.contentHash,
    })
    .onConflictDoUpdate({
      target: recipeEmbeddings.recipeId,
      set: {
        embedding: params.embedding,
        model: params.model,
        contentHash: params.contentHash,
        updatedAt: new Date(),
      },
    });
}

/** The content hash of a recipe's current embedding, or null if none. Lets a
 * re-embed be skipped when the recipe text is unchanged. */
export async function getRecipeEmbeddingHash(recipeId: string): Promise<string | null> {
  const [row] = await db
    .select({ contentHash: recipeEmbeddings.contentHash })
    .from(recipeEmbeddings)
    .where(eq(recipeEmbeddings.recipeId, recipeId))
    .limit(1);

  return row?.contentHash ?? null;
}

/** Drop a recipe's embedding (e.g. it went private). */
export async function deleteRecipeEmbedding(recipeId: string): Promise<void> {
  await db.delete(recipeEmbeddings).where(eq(recipeEmbeddings.recipeId, recipeId));
}

/**
 * Public recipes most similar to a query vector, nearest first (cosine
 * distance). Used by semantic discovery — a theme's centroid, or a search
 * string embedded as a "query". Returns recipe ids with their distance.
 */
export async function findSimilarPublicRecipes(
  embedding: number[],
  limit: number
): Promise<{ recipeId: string; distance: number }[]> {
  const vec = toVectorLiteral(embedding);

  const result = await db.execute(sql`
    SELECT re.recipe_id AS "recipeId", (re.embedding <=> ${vec}::vector) AS distance
    FROM ${recipeEmbeddings} re
    JOIN ${recipes} r ON r.id = re.recipe_id
    WHERE r.visibility = 'public'
    ORDER BY re.embedding <=> ${vec}::vector
    LIMIT ${limit}
  `);

  const rows = result.rows as { recipeId: string; distance: number | string }[];

  return rows.map((row) => ({
    recipeId: row.recipeId,
    distance: Number(row.distance),
  }));
}

/**
 * A reader's "taste vector": the mean embedding of the recipes they have
 * favourited. A For-You feed ranks recipes by nearness to this vector — closest
 * in meaning to what they already love. Returns null when they have favourited
 * nothing that carries an embedding, so the caller can fall back to a
 * non-personalised ordering. Bounded to a recent window so one prolific
 * favouriter never loads thousands of vectors.
 */
export async function getUserTasteVector(userId: string, sample = 200): Promise<number[] | null> {
  const rows = await db
    .select({ embedding: recipeEmbeddings.embedding })
    .from(recipeEmbeddings)
    .innerJoin(recipeFavorites, eq(recipeFavorites.recipeId, recipeEmbeddings.recipeId))
    .where(eq(recipeFavorites.userId, userId))
    .orderBy(desc(recipeFavorites.createdAt))
    .limit(sample);

  const first = rows[0];

  if (!first) {
    return null;
  }

  const dims = first.embedding.length;
  const mean = new Array<number>(dims).fill(0);

  for (const { embedding } of rows) {
    for (let i = 0; i < dims; i += 1) {
      mean[i] = (mean[i] ?? 0) + (embedding[i] ?? 0);
    }
  }

  for (let i = 0; i < dims; i += 1) {
    mean[i] = (mean[i] ?? 0) / rows.length;
  }

  return mean;
}

/**
 * Ids of every public recipe, batched by cursor on recipe id. Drives the
 * embedding backfill (Phase B1b) — one page at a time so a large catalogue is
 * never loaded whole. Ordered by id so the cursor is stable.
 */
export async function listPublicRecipeIds(
  limit: number,
  afterRecipeId?: string
): Promise<string[]> {
  const rows = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(
      afterRecipeId
        ? sql`${recipes.visibility} = 'public' AND ${recipes.id} > ${afterRecipeId}`
        : sql`${recipes.visibility} = 'public'`
    )
    .orderBy(recipes.id)
    .limit(limit);

  return rows.map((row) => row.id);
}

/**
 * All public-recipe embeddings, for the clustering job (Phase B2). Batched by
 * cursor on recipe id so a large catalogue can be streamed.
 */
export async function listPublicRecipeEmbeddings(
  limit: number,
  afterRecipeId?: string
): Promise<{ recipeId: string; embedding: number[] }[]> {
  const rows = await db
    .select({ recipeId: recipeEmbeddings.recipeId, embedding: recipeEmbeddings.embedding })
    .from(recipeEmbeddings)
    .innerJoin(recipes, eq(recipes.id, recipeEmbeddings.recipeId))
    .where(
      afterRecipeId
        ? sql`${recipes.visibility} = 'public' AND ${recipeEmbeddings.recipeId} > ${afterRecipeId}`
        : sql`${recipes.visibility} = 'public'`
    )
    .orderBy(recipeEmbeddings.recipeId)
    .limit(limit);

  return rows;
}
