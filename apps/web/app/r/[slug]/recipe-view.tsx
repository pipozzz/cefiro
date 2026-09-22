"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { PublicSlugSmartInstruction } from "@/components/recipe/public-slug-smart-instruction";
import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";
import { PublicServingsControl } from "@/components/recipes/public-servings-control";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { ReadonlyStepsList } from "@/components/recipes/readonly-steps-list";
import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { CommentsSection } from "@/components/social/comments-section";
import { LikeButton } from "@/components/social/like-button";
import { PrintRecipeButton } from "@/components/social/print-recipe-button";
import { PublicCookMode } from "@/components/social/public-cook-mode";
import { RecipeRating } from "@/components/social/recipe-rating";
import { SaveRecipeButton } from "@/components/social/save-recipe-button";
import { ShareRecipeButton } from "@/components/social/share-recipe-button";
import { TimerTicker } from "@/components/timer-dock";
import { usePublicRecipeConfigQuery } from "@/hooks/recipes/use-public-recipe-config-query";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { RouterOutputs } from "@norish/trpc/client";

import { RelatedRecipes } from "./related-recipes";

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-content2 flex flex-col items-center rounded-2xl px-5 py-3 text-center">
      <span className="text-foreground text-lg font-semibold">{value}</span>
      <span className="text-default-500 text-xs tracking-wide uppercase">{label}</span>
    </div>
  );
}

function AuthorChip({
  author,
}: {
  author: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}) {
  if (!author) {
    return null;
  }

  const name = author.displayName ?? `@${author.handle}`;

  return (
    <Link
      className="bg-content2 hover:bg-content3 inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 transition"
      href={`/u/${author.handle}`}
    >
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-7 w-7 rounded-full object-cover" src={author.avatarUrl} />
      ) : (
        <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-foreground text-sm font-medium">{name}</span>
    </Link>
  );
}

/** The payload the public-recipe query returns; the page server-loads it and
 * hands it in as `initialData` so this view renders content on the server. */
type PublicRecipeData = RouterOutputs["social"]["getPublicRecipe"];

export function PublicRecipeView({
  slug,
  initialData,
}: {
  slug: string;
  initialData?: PublicRecipeData;
}) {
  const trpc = useTRPC();
  const t = useTranslations("social.recipe");
  const { data, isLoading, isError } = useQuery({
    ...trpc.social.getPublicRecipe.queryOptions({ slug }),
    initialData,
    retry: false,
  });

  if (isLoading) {
    return <RecipeSkeleton />;
  }

  if (isError || !data) {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFoundTitle")} />;
  }

  return <PublicRecipeBody data={data} slug={slug} />;
}

/**
 * The rendered recipe. Split out from {@link PublicRecipeView} so the servings
 * state can be seeded from the (now guaranteed) recipe yield. This gives the
 * discovered recipe the same cooking affordances as the in-app page — scale
 * the yield, tick off ingredients, and cook through timer-aware steps — while
 * keeping the discovery-only social bar (like, save, rate, comment).
 */
function PublicRecipeBody({ slug, data }: { slug: string; data: PublicRecipeData }) {
  const t = useTranslations("social.recipe");
  const tCat = useTranslations("social.categories");
  const { units } = usePublicRecipeConfigQuery();

  const { recipe, author, recipeId, favoriteCount, rating } = data;

  // A recipe may state no yield (null); fall back to 1 so scaling is a no-op
  // rather than dividing by zero.
  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const [servings, setServings] = useState(Math.max(0.125, baseServings));
  const ratio = servings / baseServings;
  const adjustedIngredients = useMemo(
    () =>
      recipe.recipeIngredients.map((ingredient) => ({
        ...ingredient,
        amount: ingredient.amount != null ? ingredient.amount * ratio : null,
      })),
    [recipe.recipeIngredients, ratio]
  );

  const timePills = [
    recipe.prepMinutes ? { label: t("prep"), value: `${recipe.prepMinutes} min` } : null,
    recipe.cookMinutes ? { label: t("cook"), value: `${recipe.cookMinutes} min` } : null,
    recipe.totalMinutes ? { label: t("total"), value: `${recipe.totalMinutes} min` } : null,
    recipe.servings ? { label: t("servings"), value: String(recipe.servings) } : null,
    recipe.calories ? { label: t("calories"), value: `${recipe.calories} kcal` } : null,
  ].filter((p): p is { label: string; value: string } => p !== null);

  return (
    <article className="mx-auto max-w-5xl px-4 pb-24 md:px-6">
      {/* Drives the 1s countdown for the step timer chips (norish-timer links).
          The chips render via PublicSlugSmartInstruction, but without a ticker
          mounted they never count down — same pattern the share page uses. */}
      <TimerTicker />

      {/* Hero */}
      <header className="relative mt-4 overflow-hidden rounded-3xl">
        {recipe.image ? (
          <div className="relative h-64 w-full md:h-96">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={recipe.name} className="h-full w-full object-cover" src={recipe.image} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <div className="mb-3">
                <AuthorChip author={author} />
              </div>
              <h1 className="text-3xl font-bold text-white drop-shadow md:text-5xl">
                {recipe.name}
              </h1>
            </div>
          </div>
        ) : (
          <div
            className="flex h-48 w-full flex-col justify-end p-6 md:h-64 md:p-8"
            style={{ background: recipe.dishColor ?? undefined }}
          >
            <div className="mb-3">
              <AuthorChip author={author} />
            </div>
            <h1 className="text-foreground text-3xl font-bold md:text-5xl">{recipe.name}</h1>
          </div>
        )}
      </header>

      {recipe.description ? (
        <p className="text-default-600 mt-6 max-w-3xl text-lg leading-relaxed">
          {recipe.description}
        </p>
      ) : null}

      {/* Category / tag badges */}
      {(recipe.categories.length > 0 || recipe.tags.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recipe.categories.map((cat) => (
            <span
              key={`cat-${cat}`}
              className="bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-medium"
            >
              {tCat(cat)}
            </span>
          ))}
          {recipe.tags.map((tag) => (
            <Link
              key={`tag-${tag.name}`}
              className="bg-content2 text-default-600 hover:bg-content3 hover:text-foreground rounded-full px-3 py-1 text-xs font-medium transition"
              href={`/discover?tag=${encodeURIComponent(tag.name)}`}
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Meta pills */}
      {timePills.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {timePills.map((pill) => (
            <MetaPill key={pill.label} label={pill.label} value={pill.value} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 print:hidden">
        <PublicCookMode
          recipeId={recipeId}
          recipeName={recipe.name}
          steps={recipe.steps}
          systemUsed={recipe.systemUsed}
          totalMinutes={recipe.totalMinutes}
        />
        <LikeButton initialCount={favoriteCount} recipeId={recipeId} slug={slug} />
        <SaveRecipeButton recipeId={recipeId} slug={slug} />
        <ShareRecipeButton slug={slug} title={recipe.name} />
        <PrintRecipeButton />
      </div>

      <div className="mt-4 print:hidden">
        <RecipeRating
          initialAverage={rating.average}
          initialCount={rating.count}
          recipeId={recipeId}
          slug={slug}
        />
      </div>

      {/* Ingredients + steps */}
      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-foreground text-xl font-semibold">{t("ingredients")}</h2>
            <div className="flex items-center gap-2 print:hidden">
              <AmountDisplayToggle />
              <PublicServingsControl servings={servings} onChange={setServings} />
            </div>
          </div>
          <ReadonlyIngredientsList
            interactive
            ingredients={adjustedIngredients}
            systemUsed={recipe.systemUsed}
            units={units}
          />
        </aside>

        <section>
          <h2 className="text-foreground mb-4 text-xl font-semibold">{t("steps")}</h2>
          <ReadonlyStepsList
            enableTimers
            interactive
            InstructionComponent={PublicSlugSmartInstruction}
            ingredients={adjustedIngredients}
            recipeId={recipeId}
            recipeName={recipe.name}
            steps={recipe.steps}
            systemUsed={recipe.systemUsed}
            units={units}
          />

          {recipe.notes ? (
            <div className="bg-content2 mt-8 rounded-2xl p-5">
              <h3 className="text-default-500 mb-2 text-sm font-semibold tracking-wide uppercase">
                {t("notes")}
              </h3>
              <p className="text-default-700 text-sm leading-relaxed whitespace-pre-line">
                {recipe.notes}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {/* Nutrition */}
      {(recipe.calories || recipe.protein || recipe.carbs || recipe.fat) && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recipe.calories ? <MetaPill label={t("calories")} value={`${recipe.calories}`} /> : null}
          {recipe.protein ? <MetaPill label={t("protein")} value={`${recipe.protein} g`} /> : null}
          {recipe.carbs ? <MetaPill label={t("carbs")} value={`${recipe.carbs} g`} /> : null}
          {recipe.fat ? <MetaPill label={t("fat")} value={`${recipe.fat} g`} /> : null}
        </div>
      )}

      {recipe.url ? (
        <p className="text-default-500 mt-10 text-sm">
          {t("source")}{" "}
          <a
            className="text-primary hover:underline"
            href={recipe.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {recipe.url}
          </a>
        </p>
      ) : null}

      <div className="print:hidden">
        <RelatedRecipes recipeId={recipeId} />
      </div>

      <div className="print:hidden">
        <CommentsSection
          recipeAuthorHandle={author?.handle ?? null}
          recipeId={recipeId}
          slug={slug}
        />
      </div>
    </article>
  );
}
