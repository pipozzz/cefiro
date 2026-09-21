"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * "Recipe of the day": one public recipe, the same for everyone and rotating
 * once a day (chosen server-side by a date hash). A small curated hero at the
 * top of default discovery — a reason for repeat visitors to come back, and a
 * warm first impression for a signed-out landing. Renders nothing until there
 * is a pick.
 */
export function RecipeOfTheDay() {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");

  const { data } = useQuery({
    ...trpc.social.recipeOfTheDay.queryOptions(),
    retry: false,
  });

  const recipe = data?.recipe;

  if (!recipe) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="text-default-500 mb-3 text-xs font-semibold tracking-wide uppercase">
        {t("recipeOfTheDay")}
      </h2>
      <SocialRecipeGrid recipes={[recipe]} />
    </section>
  );
}
