import { sql } from "drizzle-orm";

import { recipeImages } from "../schema";

/**
 * SQL twin of `primaryRecipeImage` (@norish/shared/lib/recipe-media): the
 * first gallery image by order, falling back to the legacy `recipes.image`
 * scalar. Every list-shaped projection serves its `image` through this, so
 * nothing reads the deprecated scalar directly; a change here must move
 * with the shared helper.
 *
 * It lives in its own module (rather than in the `recipes` repository) so the
 * public listing repositories can share it without importing that heavily
 * mocked repo — a test that `vi.mock`s `repositories/recipes` must not have to
 * re-declare this constant.
 *
 * The outer references are spelled `"recipes"."id"`/`"recipes"."image"` by
 * hand: interpolating the drizzle columns renders them unqualified in plain
 * selects, and inside the subquery an unqualified `"id"` resolves to the
 * gallery's own column — silently matching nothing.
 */
export const PRIMARY_IMAGE_SQL = sql<string | null>`COALESCE(
  (SELECT gallery.image FROM ${recipeImages} AS gallery
    WHERE gallery.recipe_id = "recipes"."id"
    ORDER BY COALESCE(gallery."order", 0) ASC, gallery.created_at ASC
    LIMIT 1),
  "recipes"."image"
)`;
