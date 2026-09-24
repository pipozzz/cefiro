import { createHash } from "node:crypto";

import type { FullRecipeDTO } from "@norish/shared/contracts";

/**
 * The text a recipe is embedded from. Deliberately the human-meaningful signal
 * a semantic theme should cluster on — what the dish is, what goes in it, what
 * cuisine and course it belongs to — and nothing structural (ids, ratings,
 * timestamps) that would only add noise. Order is stable so the same recipe
 * always hashes to the same string.
 */
export function buildRecipeEmbeddingText(recipe: FullRecipeDTO): string {
  const lines: string[] = [recipe.name.trim()];

  if (recipe.description?.trim()) {
    lines.push(recipe.description.trim());
  }

  const cuisines = recipe.cuisines.map((cuisine) => cuisine.name).filter(Boolean);

  if (cuisines.length > 0) {
    lines.push(`Cuisine: ${cuisines.join(", ")}`);
  }

  if (recipe.categories.length > 0) {
    lines.push(`Course: ${recipe.categories.join(", ")}`);
  }

  const tags = recipe.tags.map((tag) => tag.name).filter(Boolean);

  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(", ")}`);
  }

  const ingredients = recipe.recipeIngredients
    .map((ingredient) => ingredient.ingredientName.trim())
    .filter(Boolean);

  if (ingredients.length > 0) {
    lines.push(`Ingredients: ${ingredients.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * A stable fingerprint of what would be embedded. The model is folded in so a
 * model change forces a re-embed even when the text is byte-for-byte the same;
 * the worker compares this against the stored hash to skip unchanged recipes.
 */
export function embeddingContentHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}\n${text}`).digest("hex");
}
