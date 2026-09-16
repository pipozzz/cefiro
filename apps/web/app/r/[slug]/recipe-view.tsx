"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { CommentsSection } from "@/components/social/comments-section";
import { LikeButton } from "@/components/social/like-button";
import { RecipeRating } from "@/components/social/recipe-rating";
import { SaveRecipeButton } from "@/components/social/save-recipe-button";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }

  // Trim trailing zeros; keep up to 2 decimals.
  return Number.parseFloat(amount.toFixed(2)).toString();
}

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
      href={`/u/${author.handle}`}
      className="bg-content2/80 hover:bg-content3 inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 backdrop-blur transition"
    >
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-foreground text-sm font-medium">{name}</span>
    </Link>
  );
}

export function PublicRecipeView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const t = useTranslations("social.recipe");
  const tCat = useTranslations("social.categories");
  const { data, isLoading, isError } = useQuery({
    ...trpc.social.getPublicRecipe.queryOptions({ slug }),
    retry: false,
  });

  if (isLoading) {
    return <RecipeSkeleton />;
  }

  if (isError || !data) {
    return <NotFoundView title={t("notFoundTitle")} message={t("notFoundMessage")} />;
  }

  const { recipe, author, recipeId, favoriteCount, rating } = data;

  const timePills = [
    recipe.prepMinutes ? { label: t("prep"), value: `${recipe.prepMinutes} min` } : null,
    recipe.cookMinutes ? { label: t("cook"), value: `${recipe.cookMinutes} min` } : null,
    recipe.totalMinutes ? { label: t("total"), value: `${recipe.totalMinutes} min` } : null,
    recipe.servings ? { label: t("servings"), value: String(recipe.servings) } : null,
    recipe.calories ? { label: t("calories"), value: `${recipe.calories} kcal` } : null,
  ].filter((p): p is { label: string; value: string } => p !== null);

  return (
    <article className="mx-auto max-w-5xl px-4 pb-24 md:px-6">
      {/* Hero */}
      <header className="relative mt-4 overflow-hidden rounded-3xl">
        {recipe.image ? (
          <div className="relative h-64 w-full md:h-96">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" />
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
              href={`/discover?tag=${encodeURIComponent(tag.name)}`}
              className="bg-content2 text-default-600 hover:bg-content3 hover:text-foreground rounded-full px-3 py-1 text-xs font-medium transition"
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

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <LikeButton recipeId={recipeId} slug={slug} initialCount={favoriteCount} />
        <SaveRecipeButton recipeId={recipeId} slug={slug} />
      </div>

      <div className="mt-4">
        <RecipeRating
          recipeId={recipeId}
          slug={slug}
          initialAverage={rating.average}
          initialCount={rating.count}
        />
      </div>

      {/* Ingredients + steps */}
      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,20rem)_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <h2 className="text-foreground mb-4 text-xl font-semibold">{t("ingredients")}</h2>
          <ul className="space-y-2">
            {recipe.recipeIngredients.map((ing, i) => (
              <li
                key={`${ing.ingredientName}-${i}`}
                className="border-default-100 flex items-baseline gap-2 border-b pb-2 text-sm"
              >
                <span className="text-foreground font-medium">
                  {formatAmount(ing.amount)} {ing.unit ?? ""}
                </span>
                <span className="text-default-600">{ing.ingredientName}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section>
          <h2 className="text-foreground mb-4 text-xl font-semibold">{t("steps")}</h2>
          <ol className="space-y-6">
            {recipe.steps.map((step, i) => (
              <li key={`step-${i}`} className="flex gap-4">
                <span className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-default-700 leading-relaxed">{step.step}</p>
                  {step.images && step.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {step.images.map((img, j) =>
                        img.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={j}
                            src={img.image}
                            alt=""
                            className="h-32 w-32 rounded-xl object-cover"
                          />
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

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
            href={recipe.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline"
          >
            {recipe.url}
          </a>
        </p>
      ) : null}

      <CommentsSection
        recipeId={recipeId}
        slug={slug}
        recipeAuthorHandle={author?.handle ?? null}
      />
    </article>
  );
}
