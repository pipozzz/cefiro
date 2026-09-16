"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { FollowButton } from "@/components/social/follow-button";
import { StarsDisplay } from "@/components/social/stars-display";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type RecipeCard = {
  slug: string | null;
  name: string;
  description: string | null;
  image: string | null;
  dishColor: string | null;
  totalMinutes: number | null;
  publishedAt: Date | null;
  rating?: { average: number | null; count: number };
};

function RecipeCardTile({ recipe }: { recipe: RecipeCard }) {
  if (!recipe.slug) {
    return null;
  }

  return (
    <Link
      href={`/r/${recipe.slug}`}
      className="group bg-content1 ring-default-100 flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="bg-content2 relative aspect-[4/3] w-full overflow-hidden">
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
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-foreground line-clamp-2 font-semibold">{recipe.name}</h3>
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
      </div>
    </Link>
  );
}

type CookbookCard = {
  slug: string;
  title: string;
  description: string | null;
  recipeCount: number;
  coverImages: string[];
};

function CookbookTile({ cookbook, countLabel }: { cookbook: CookbookCard; countLabel: string }) {
  const covers = cookbook.coverImages.slice(0, 4);

  return (
    <Link
      href={`/c/${cookbook.slug}`}
      className="group bg-content1 ring-default-100 flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="bg-content2 grid aspect-[3/2] w-full grid-cols-2 grid-rows-2 gap-0.5">
        {covers.length > 0
          ? Array.from({ length: 4 }).map((_, i) =>
              covers[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={covers[i]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div key={i} className="bg-content3 h-full w-full" />
              )
            )
          : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-foreground group-hover:text-primary line-clamp-1 font-semibold">
          {cookbook.title}
        </h3>
        <p className="text-default-500 mt-0.5 text-xs">{countLabel}</p>
        {cookbook.description ? (
          <p className="text-default-500 mt-1 line-clamp-2 text-sm">{cookbook.description}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function PublicProfileView({ handle }: { handle: string }) {
  const trpc = useTRPC();
  const t = useTranslations("social.profile");
  const tCookbook = useTranslations("social.cookbook");

  const profileQuery = useQuery({
    ...trpc.social.getProfile.queryOptions({ handle }),
    retry: false,
  });

  const recipesQuery = useQuery({
    ...trpc.social.listProfileRecipes.queryOptions({ handle, limit: 24 }),
    retry: false,
    enabled: profileQuery.isSuccess,
  });

  const cookbooksQuery = useQuery({
    ...trpc.social.listPublicCookbooks.queryOptions({ handle }),
    retry: false,
    enabled: profileQuery.isSuccess,
  });

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse px-4 py-10 md:px-6">
        <div className="bg-content2 h-24 w-24 rounded-full" />
        <div className="bg-content2 mt-4 h-6 w-48 rounded" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <NotFoundView title={t("notFoundTitle")} message={t("notFoundMessage")} />;
  }

  const { profile, counts } = profileQuery.data;
  const displayName = profile.displayName ?? `@${profile.handle}`;
  const recipes = recipesQuery.data?.recipes ?? [];
  const cookbooks = cookbooksQuery.data?.cookbooks ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 md:px-6">
      {/* Profile header */}
      <header className="flex flex-col items-center gap-4 pt-10 text-center md:flex-row md:items-start md:text-left">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="ring-default-200 h-24 w-24 rounded-full object-cover ring-2"
          />
        ) : (
          <span className="bg-primary text-primary-foreground flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex-1">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold md:text-3xl">{displayName}</h1>
              <p className="text-default-500">@{profile.handle}</p>
            </div>
            <FollowButton handle={profile.handle} />
          </div>

          <div className="mt-3 flex items-center justify-center gap-5 text-sm md:justify-start">
            <span>
              <span className="text-foreground font-semibold">{counts.followers}</span>{" "}
              <span className="text-default-500">
                {t("followersLabel", { count: counts.followers })}
              </span>
            </span>
            <span>
              <span className="text-foreground font-semibold">{counts.following}</span>{" "}
              <span className="text-default-500">{t("following")}</span>
            </span>
          </div>

          {profile.bio ? <p className="text-default-600 mt-3 max-w-2xl">{profile.bio}</p> : null}
          <div className="text-default-500 mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm md:justify-start">
            {profile.location ? <span>📍 {profile.location}</span> : null}
            {profile.websiteUrl ? (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary hover:underline"
              >
                {profile.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* Cookbooks */}
      {cookbooks.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-foreground mb-4 text-lg font-semibold">{t("cookbooksHeading")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cookbooks.map((cookbook) => (
              <CookbookTile
                key={cookbook.slug}
                cookbook={cookbook}
                countLabel={tCookbook("recipesCount", { count: cookbook.recipeCount })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Recipes grid */}
      <section className="mt-10">
        <h2 className="text-foreground mb-4 text-lg font-semibold">
          {t("recipes")} {recipes.length > 0 ? `(${recipes.length})` : ""}
        </h2>

        {recipesQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-content2 aspect-[4/3] animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-8 text-center">
            {t("noRecipes")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeCardTile key={recipe.slug} recipe={recipe} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
