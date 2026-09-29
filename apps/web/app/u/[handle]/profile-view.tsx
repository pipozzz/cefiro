"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { ChefHatIcon } from "@/components/social/chef-hat-icon";
import { FollowButton } from "@/components/social/follow-button";
import { ShareLinkButton } from "@/components/social/share-link-button";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

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
      className="group bg-content1 ring-default-100 flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md"
      href={`/c/${cookbook.slug}`}
    >
      <div className="bg-content2 grid aspect-[3/2] w-full grid-cols-2 grid-rows-2 gap-0.5">
        {covers.length > 0
          ? Array.from({ length: 4 }).map((_, i) =>
              covers[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} alt="" className="h-full w-full object-cover" src={covers[i]} />
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

  const themesQuery = useQuery({
    ...trpc.social.profileThemes.queryOptions({ handle }),
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
    return <NotFoundView message={t("notFoundMessage")} title={t("notFoundTitle")} />;
  }

  const { profile, counts } = profileQuery.data;
  // Fall back to the bare handle (not "@handle") so the name heading doesn't read
  // "@pipo" directly above the "@pipo" handle line.
  const displayName = profile.displayName ?? profile.handle;
  const recipes = recipesQuery.data?.recipes ?? [];
  const cookbooks = cookbooksQuery.data?.cookbooks ?? [];
  const themes = themesQuery.data?.themes ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 md:px-6">
      {/* Profile header */}
      <header className="flex flex-col items-center gap-4 pt-10 text-center md:flex-row md:items-start md:text-left">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="ring-default-200 h-24 w-24 rounded-full object-cover ring-2"
            src={profile.avatarUrl}
          />
        ) : (
          <span className="bg-primary text-primary-foreground flex h-24 w-24 items-center justify-center rounded-full">
            <ChefHatIcon className="h-12 w-12" />
          </span>
        )}

        <div className="flex-1">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold md:text-3xl">{displayName}</h1>
              <p className="text-default-500">@{profile.handle}</p>
            </div>
            <div className="flex items-center gap-2">
              <ShareLinkButton path={`/u/${profile.handle}`} title={displayName} />
              <FollowButton handle={profile.handle} />
            </div>
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
                className="text-primary hover:underline"
                href={profile.websiteUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                {profile.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* Themes this cook's recipes fall into — each links to its theme page. */}
      {themes.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-foreground mb-4 text-lg font-semibold">{t("themesHeading")}</h2>
          <ul className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <li key={theme.slug}>
                <Link
                  className="bg-content2 hover:bg-content3 text-default-600 hover:text-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm no-underline transition"
                  href={`/discover/themes/${theme.slug}`}
                >
                  <span>{theme.name}</span>
                  <span className="text-default-400 text-xs">{theme.recipeCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
          <SocialRecipeGrid recipes={recipes} />
        )}
      </section>
    </div>
  );
}
