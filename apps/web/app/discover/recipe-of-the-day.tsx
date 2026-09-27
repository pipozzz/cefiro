"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import OriginFlag from "@/components/recipes/origin-flag";
import { ClockIcon, UserGroupIcon } from "@heroicons/react/16/solid";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * "Recipe of the day": one public recipe, the same for everyone and rotating
 * once a day (chosen server-side by a date hash). Rendered as a wide hero banner
 * at the top of default discovery — a deliberate, image-forward feature (not a
 * lone grid card), a reason for repeat visitors to return and a warm first
 * impression for a signed-out landing. Renders nothing until there is a pick.
 */
export function RecipeOfTheDay() {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");

  const { data } = useQuery({
    ...trpc.social.recipeOfTheDay.queryOptions(),
    retry: false,
  });

  const recipe = data?.recipe;

  if (!recipe?.slug) {
    return null;
  }

  return (
    <section className="mb-8">
      <Link
        className="group relative block h-56 w-full overflow-hidden rounded-3xl no-underline md:h-72"
        href={`/r/${recipe.slug}`}
      >
        {recipe.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={recipe.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            src={recipe.image}
          />
        ) : (
          <div
            className="absolute inset-0 h-full w-full"
            style={{ background: recipe.dishColor ?? undefined }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        <span className="bg-primary text-primary-foreground absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          {t("recipeOfTheDay")}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
          <h2
            className="text-2xl font-bold text-white drop-shadow md:text-3xl"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            <OriginFlag className="mr-1.5" originCountry={recipe.originCountry} />
            {recipe.name}
          </h2>

          {recipe.description ? (
            <p
              className="mt-1 max-w-2xl text-sm text-white/85 drop-shadow md:text-base"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {recipe.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/90">
            {recipe.totalMinutes ? (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                {recipe.totalMinutes} min
              </span>
            ) : null}
            {typeof recipe.servings === "number" && recipe.servings > 0 ? (
              <span className="inline-flex items-center gap-1">
                <UserGroupIcon className="h-4 w-4" />
                {recipe.servings}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </section>
  );
}
