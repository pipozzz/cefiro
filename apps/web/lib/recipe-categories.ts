import { recipeCategoryValues } from "@norish/shared/contracts/zod";

/** A recipe meal category, e.g. "Breakfast". */
export type RecipeCategory = (typeof recipeCategoryValues)[number];

/** Lowercase URL slug for a category (e.g. "Breakfast" -> "breakfast"). */
export function categorySlug(category: RecipeCategory): string {
  return category.toLowerCase();
}

const BY_SLUG: Record<string, RecipeCategory> = Object.fromEntries(
  recipeCategoryValues.map((c) => [categorySlug(c), c])
);

/** Resolve a URL slug back to its category enum value, or null when unknown. */
export function categoryFromSlug(slug: string): RecipeCategory | null {
  return BY_SLUG[slug.toLowerCase()] ?? null;
}

/** Every category slug, for building landing pages and the sitemap. */
export const ALL_CATEGORY_SLUGS: string[] = recipeCategoryValues.map(categorySlug);

/** Every category, in canonical order. */
export const ALL_CATEGORIES: readonly RecipeCategory[] = recipeCategoryValues;
