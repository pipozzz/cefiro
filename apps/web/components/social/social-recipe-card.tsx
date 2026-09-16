"use client";

import Link from "next/link";
import { HeartIcon } from "@heroicons/react/24/solid";

import { StarsDisplay } from "./stars-display";

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

export function SocialRecipeCard({ recipe }: { recipe: SocialRecipeCardData }) {
  if (!recipe.slug) {
    return null;
  }

  const authorName =
    recipe.author?.displayName ?? (recipe.author ? `@${recipe.author.handle}` : null);

  return (
    <div className="group bg-content1 ring-default-100 flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/r/${recipe.slug}`}
        className="bg-content2 relative block aspect-[4/3] w-full overflow-hidden"
      >
        {recipe.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image}
            alt={recipe.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full" style={{ background: recipe.dishColor ?? undefined }} />
        )}
        {recipe.totalMinutes ? (
          <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            {recipe.totalMinutes} min
          </span>
        ) : null}
        {typeof recipe.favoriteCount === "number" && recipe.favoriteCount > 0 ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            <HeartIcon className="h-3 w-3 text-red-400" />
            {recipe.favoriteCount}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/r/${recipe.slug}`}>
          <h3 className="text-foreground group-hover:text-primary line-clamp-2 font-semibold">
            {recipe.name}
          </h3>
        </Link>
        {recipe.description ? (
          <p className="text-default-500 mt-1 line-clamp-2 text-sm">{recipe.description}</p>
        ) : null}

        {recipe.rating && recipe.rating.average && recipe.rating.count > 0 ? (
          <div className="mt-2 flex items-center gap-1.5">
            <StarsDisplay value={recipe.rating.average} size={13} />
            <span className="text-default-500 text-xs">
              {recipe.rating.average.toFixed(1)} ({recipe.rating.count})
            </span>
          </div>
        ) : null}

        {recipe.author && authorName ? (
          <Link
            href={`/u/${recipe.author.handle}`}
            className="text-default-500 hover:text-foreground mt-3 inline-flex items-center gap-2 text-sm"
          >
            {recipe.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.author.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold">
                {authorName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{authorName}</span>
          </Link>
        ) : null}
      </div>
    </div>
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
