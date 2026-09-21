"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * "More like this": public recipes sharing tags with the one being viewed, so a
 * reader (often an anonymous, link-arriving one) has somewhere to go next.
 * Renders nothing when there are no related recipes, so it never leaves an
 * empty heading on a niche recipe.
 */
export function RelatedRecipes({ recipeId }: { recipeId: string }) {
  const trpc = useTRPC();
  const t = useTranslations("social.recipe");

  const { data } = useQuery({
    ...trpc.social.relatedRecipes.queryOptions({ recipeId, limit: 6 }),
    retry: false,
  });

  const recipes = data?.recipes ?? [];

  if (recipes.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <h2 className="text-foreground mb-4 text-xl font-semibold">{t("moreLikeThis")}</h2>
      <SocialRecipeGrid recipes={recipes} />
    </section>
  );
}
