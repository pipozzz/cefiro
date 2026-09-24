import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { EMBEDDING_DIMENSIONS, vector } from "./recipe-embeddings";
import { recipes } from "./recipes";

/**
 * Semantic discovery themes (Phase B2). A clustering job groups the public
 * recipe embeddings, names each cluster, and rebuilds this whole table. Each
 * row is one theme: its label, how many recipes fell in it, its centroid (so
 * discovery can find recipes near it — Phase B3), and a representative recipe
 * that supplies the tile image.
 *
 * The table is rebuilt wholesale on every clustering run, so there are only
 * ever a handful of rows and the centroid needs no vector index.
 */
export const themes = pgTable("themes", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Human label — LLM-named when AI is on, otherwise derived from the cluster. */
  name: text("name").notNull(),
  /** How many public recipes fell in this cluster. */
  recipeCount: integer("recipe_count").notNull(),
  /** The cluster's mean embedding; drives Phase B3 similarity search. */
  centroid: vector("centroid", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  /** The recipe nearest the centroid — supplies the tile image. */
  representativeRecipeId: uuid("representative_recipe_id").references(() => recipes.id, {
    onDelete: "set null",
  }),
  /** Representative recipe's slug + primary image, denormalised for the tile. */
  slug: text("slug"),
  image: text("image"),
  /** Display order, largest cluster first. */
  rank: integer("rank").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
