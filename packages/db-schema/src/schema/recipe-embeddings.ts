import { customType, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

/** Voyage `voyage-3` embedding dimension. */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * A pgvector `vector(N)` column. Drizzle has no native pgvector type, so this
 * custom type maps a `number[]` to/from pgvector's `"[1,2,3]"` text form.
 * Exported so other embedding-backed tables (e.g. theme centroids) reuse it.
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(",")
      .map((n) => Number(n));
  },
});

/**
 * One embedding per PUBLIC recipe, for semantic discovery (Phase B). The vector
 * is Voyage's embedding of the recipe's text (name + description + ingredients);
 * `contentHash` lets a re-embed be skipped when the text is unchanged. The HNSW
 * cosine index is created in the migration (drizzle can't express the operator
 * class for a custom type).
 */
export const recipeEmbeddings = pgTable("recipe_embeddings", {
  recipeId: uuid("recipe_id")
    .primaryKey()
    .references(() => recipes.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  model: text("model").notNull(),
  contentHash: text("content_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecipeEmbedding = typeof recipeEmbeddings.$inferSelect;
export type NewRecipeEmbedding = typeof recipeEmbeddings.$inferInsert;
