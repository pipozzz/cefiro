import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipeCategoryEnum } from "./recipe-categories";
import { versionColumn } from "./shared";

export const measurementSystemEnum = pgEnum("measurement_system", ["metric", "us"]);

/**
 * Recipe visibility for the social layer (cefiro):
 * - `private`  — owner/household only (default, preserves norish behaviour).
 * - `unlisted` — anyone with the `slug` link can view; not listed in discovery.
 * - `public`   — listed in profiles, feeds and discovery.
 */
export const recipeVisibilityEnum = pgEnum("recipe_visibility", ["private", "unlisted", "public"]);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    /**
     * @deprecated — the primary image lives in `recipe_images`. Readers
     * resolve gallery-first (`primaryRecipeImage` / the repository's
     * PRIMARY_IMAGE_SQL); writers never store a value here any more (a
     * payload scalar is translated into the gallery, and media-touching
     * writes clear this column). Only untouched legacy rows still carry a
     * value, until a migration retires the column.
     */
    image: text("image"),
    url: text("url"),
    servings: integer("servings").notNull().default(1),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    totalMinutes: integer("total_minutes"),
    notes: text("notes"),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    calories: integer("calories"),
    fat: numeric("fat", { precision: 6, scale: 2 }),
    carbs: numeric("carbs", { precision: 6, scale: 2 }),
    protein: numeric("protein", { precision: 6, scale: 2 }),
    // Recipe Provenance. The country is an ISO-3166-1 alpha-2 code — kept
    // authoritative for flags and pickers — beside its written name, which is
    // recipe content: inference writes it in the language of the recipe
    // itself (that language is deliberately not recorded), and a manual pick
    // stores the label the editor saw. The region is free text and the note
    // is written in the recipe's language; none of the three is translated.
    // Rows with a code and no name fall back to endonym rendering.
    originCountry: text("origin_country"),
    originCountryName: text("origin_country_name"),
    originRegion: text("origin_region"),
    provenanceNote: text("provenance_note"),
    // Set when this recipe was created by "saving" (forking) a public recipe
    // from the social layer: it points at the source recipe's id. A loose
    // pointer, not a DB foreign key — the source may later be deleted or made
    // private, and the fork must survive that untouched. Used to attribute the
    // copy to the original and to dedupe repeat saves (see the composite index
    // below), so a member who saves the same recipe twice reopens their copy
    // instead of piling up duplicates.
    savedFromRecipeId: uuid("saved_from_recipe_id"),
    // The Dish Colour (ADR-0023): one colour extracted from the recipe's
    // primary image when that image is stored, as a `#rrggbb` hex string.
    // Derived, never supplied — it does not travel in a Recipe Archive, and
    // a recipe with no image simply has none.
    dishColor: text("dish_color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    categories: recipeCategoryEnum("categories").array().notNull().default([]),
    // Social layer (cefiro): sharing visibility, public URL slug, and the
    // moment a recipe first became non-private. `slug` is globally unique when
    // set (Postgres allows many NULLs), so it can back `/r/[slug]` pages.
    visibility: recipeVisibilityEnum("visibility").notNull().default("private"),
    slug: text("slug"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...versionColumn,
  },
  (t) => [
    index("idx_recipes_user_id").on(t.userId),
    index("idx_recipes_name").on(t.name),
    unique("uq_recipes_url_user").on(t.url, t.userId),
    index("idx_recipes_created_at_desc").on(t.createdAt.desc()),
    index("idx_recipes_total_minutes").on(t.totalMinutes),
    index("idx_recipes_prep_minutes").on(t.prepMinutes),
    index("idx_recipes_cook_minutes").on(t.cookMinutes),
    uniqueIndex("uq_recipes_slug").on(t.slug),
    // Discovery: list public recipes newest-first.
    index("idx_recipes_visibility_published_at").on(t.visibility, t.publishedAt.desc()),
    // Dedupe "save" (fork): find the copy a user already made of a source.
    index("idx_recipes_user_saved_from").on(t.userId, t.savedFromRecipeId),
  ]
);
