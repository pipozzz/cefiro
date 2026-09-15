"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { CommentsSection } from "@/components/social/comments-section";
import { LikeButton } from "@/components/social/like-button";
import { RecipeRating } from "@/components/social/recipe-rating";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { useQuery } from "@tanstack/react-query";

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }

  // Trim trailing zeros; keep up to 2 decimals.
  return Number.parseFloat(amount.toFixed(2)).toString();
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-content2 px-5 py-3 text-center">
      <span className="text-lg font-semibold text-foreground">{value}</span>
      <span className="text-xs uppercase tracking-wide text-default-500">{label}</span>
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
      className="inline-flex items-center gap-2 rounded-full bg-content2/80 py-1 pl-1 pr-3 backdrop-blur transition hover:bg-content3"
    >
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-medium text-foreground">{name}</span>
    </Link>
  );
}

export function PublicRecipeView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const { data, isLoading, isError } = useQuery({
    ...trpc.social.getPublicRecipe.queryOptions({ slug }),
    retry: false,
  });

  if (isLoading) {
    return <RecipeSkeleton />;
  }

  if (isError || !data) {
    return (
      <NotFoundView title="Recipe not found" message="This recipe is private or does not exist." />
    );
  }

  const { recipe, author, recipeId, favoriteCount, rating } = data;

  const timePills = [
    recipe.prepMinutes ? { label: "Prep", value: `${recipe.prepMinutes} min` } : null,
    recipe.cookMinutes ? { label: "Cook", value: `${recipe.cookMinutes} min` } : null,
    recipe.totalMinutes ? { label: "Total", value: `${recipe.totalMinutes} min` } : null,
    recipe.servings ? { label: "Servings", value: String(recipe.servings) } : null,
    recipe.calories ? { label: "Calories", value: `${recipe.calories} kcal` } : null,
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
            <h1 className="text-3xl font-bold text-foreground md:text-5xl">{recipe.name}</h1>
          </div>
        )}
      </header>

      {recipe.description ? (
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-default-600">
          {recipe.description}
        </p>
      ) : null}

      {/* Category / tag badges */}
      {(recipe.categories.length > 0 || recipe.tags.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recipe.categories.map((cat) => (
            <span
              key={`cat-${cat}`}
              className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
            >
              {cat}
            </span>
          ))}
          {recipe.tags.map((tag) => (
            <span
              key={`tag-${tag.name}`}
              className="rounded-full bg-content2 px-3 py-1 text-xs font-medium text-default-600"
            >
              #{tag.name}
            </span>
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

      <div className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-4">
        <LikeButton recipeId={recipeId} slug={slug} initialCount={favoriteCount} />
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
          <h2 className="mb-4 text-xl font-semibold text-foreground">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.recipeIngredients.map((ing, i) => (
              <li
                key={`${ing.ingredientName}-${i}`}
                className="flex items-baseline gap-2 border-b border-default-100 pb-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {formatAmount(ing.amount)} {ing.unit ?? ""}
                </span>
                <span className="text-default-600">{ing.ingredientName}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Steps</h2>
          <ol className="space-y-6">
            {recipe.steps.map((step, i) => (
              <li key={`step-${i}`} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="leading-relaxed text-default-700">{step.step}</p>
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
            <div className="mt-8 rounded-2xl bg-content2 p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-default-500">
                Notes
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-default-700">
                {recipe.notes}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      {/* Nutrition */}
      {(recipe.calories || recipe.protein || recipe.carbs || recipe.fat) && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recipe.calories ? <MetaPill label="Calories" value={`${recipe.calories}`} /> : null}
          {recipe.protein ? <MetaPill label="Protein" value={`${recipe.protein} g`} /> : null}
          {recipe.carbs ? <MetaPill label="Carbs" value={`${recipe.carbs} g`} /> : null}
          {recipe.fat ? <MetaPill label="Fat" value={`${recipe.fat} g`} /> : null}
        </div>
      )}

      {recipe.url ? (
        <p className="mt-10 text-sm text-default-500">
          Source:{" "}
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

      <CommentsSection recipeId={recipeId} slug={slug} />
    </article>
  );
}
