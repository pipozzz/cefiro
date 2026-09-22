"use client";

import Link from "next/link";
import RecipeMetadata, { photoChipClassName } from "@/components/dashboard/recipe-metadata";
import { HeartIcon } from "@heroicons/react/20/solid";
import { Chip } from "@heroui/react";

export type SocialRecipeCardData = {
  slug: string | null;
  name: string;
  description: string | null;
  image: string | null;
  dishColor: string | null;
  totalMinutes: number | null;
  favoriteCount?: number;
  rating?: { average: number | null; count: number };
  author?: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

/**
 * A public recipe tile for discovery/feed/profile. Deliberately mirrors the
 * Library dashboard card (same 340px frame, 236px photo with overlaid metadata
 * chips, and a title/description block) so signed-out discovery reads with the
 * same polish as a reader's own library — it just links to the public
 * `/r/[slug]` view and carries the author instead of favourite/edit actions.
 */
export function SocialRecipeCard({ recipe }: { recipe: SocialRecipeCardData }) {
  if (!recipe.slug) {
    return null;
  }

  const authorName =
    recipe.author?.displayName ?? (recipe.author ? `@${recipe.author.handle}` : null);
  const timeLabel = recipe.totalMinutes ? `${recipe.totalMinutes} min` : null;

  return (
    <Link
      className="group border-border bg-surface shadow-surface relative flex h-[340px] w-full flex-col overflow-hidden rounded-3xl border no-underline transition hover:shadow-md"
      href={`/r/${recipe.slug}`}
    >
      {/* Photo (236px) with overlaid metadata — same treatment as Library */}
      <div className="bg-surface-secondary relative h-[236px] w-full shrink-0 overflow-hidden">
        {recipe.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={recipe.name}
            className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            src={recipe.image}
          />
        ) : (
          <div className="h-full w-full" style={{ background: recipe.dishColor ?? undefined }} />
        )}

        <RecipeMetadata averageRating={recipe.rating?.average ?? null} timeLabel={timeLabel} />

        {/* Community favourite count — top-left, where Library shows the heart */}
        {typeof recipe.favoriteCount === "number" && recipe.favoriteCount > 0 ? (
          <div className="absolute top-2 left-2 z-20">
            <Chip className={photoChipClassName} size="sm" variant="soft">
              <HeartIcon className="text-danger h-4 w-4" />
              <Chip.Label>{recipe.favoriteCount}</Chip.Label>
            </Chip>
          </div>
        ) : null}

        {/* Author — bottom-left over the photo, so the tile frame stays identical
            to Library while still crediting the cook */}
        {recipe.author && authorName ? (
          <div className="absolute bottom-2 left-2 z-20">
            <span
              className={`${photoChipClassName} inline-flex max-w-[12rem] items-center gap-1 py-0.5`}
            >
              {recipe.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                  src={recipe.author.avatarUrl}
                />
              ) : (
                <span className="bg-primary text-primary-foreground flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold">
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate">{authorName}</span>
            </span>
          </div>
        ) : null}
      </div>

      {/* Title + description (104px) */}
      <div className="flex flex-1 flex-col overflow-hidden px-4 pt-3 pb-3">
        <h3 className="text-foreground truncate text-base font-semibold group-hover:underline">
          {recipe.name}
        </h3>
        {recipe.description ? (
          <p
            className="text-muted mt-1 text-sm"
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
      </div>
    </Link>
  );
}

export function SocialRecipeGrid({ recipes }: { recipes: SocialRecipeCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((recipe) => (
        <SocialRecipeCard key={recipe.slug} recipe={recipe} />
      ))}
    </div>
  );
}
