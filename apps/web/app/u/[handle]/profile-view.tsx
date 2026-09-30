"use client";

import { useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { ChefHatIcon } from "@/components/social/chef-hat-icon";
import { FollowButton } from "@/components/social/follow-button";
import { ShareLinkButton } from "@/components/social/share-link-button";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/** Show an Instagram link as "@handle" when it's an instagram.com URL, else a
 * plain "Instagram" label. */
function instagramLabel(url: string): string {
  const match = /instagram\.com\/([^/?#]+)/i.exec(url);

  return match?.[1] ? `@${match[1]}` : "Instagram";
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

  // Clicking a theme filters this profile's recipes in place (rather than
  // leaving for the global theme page).
  const [selectedThemeSlug, setSelectedThemeSlug] = useState<string | null>(null);

  const themeRecipesQuery = useQuery({
    ...trpc.social.profileThemeRecipes.queryOptions({ handle, slug: selectedThemeSlug ?? "" }),
    enabled: profileQuery.isSuccess && !!selectedThemeSlug,
    placeholderData: keepPreviousData,
    retry: false,
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

  // When a theme chip is active, the grid shows that theme's recipes instead.
  const isThemeFiltered = !!selectedThemeSlug;
  const shownRecipes = isThemeFiltered ? (themeRecipesQuery.data?.recipes ?? []) : recipes;
  const recipesLoading = isThemeFiltered ? themeRecipesQuery.isLoading : recipesQuery.isLoading;

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
            {profile.instagramUrl ? (
              <a
                className="text-primary hover:underline"
                href={profile.instagramUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                {instagramLabel(profile.instagramUrl)}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* Themes this cook's recipes fall into — small blocks that FILTER the
          recipe grid below (toggle), rather than leaving for the theme page. */}
      {themes.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-foreground mb-4 text-lg font-semibold">{t("themesHeading")}</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {themes.map((theme) => {
              const active = selectedThemeSlug === theme.slug;

              return (
                <li key={theme.slug}>
                  <button
                    aria-pressed={active}
                    className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                      active
                        ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : "border-border hover:border-default-300"
                    }`}
                    type="button"
                    onClick={() =>
                      setSelectedThemeSlug((prev) => (prev === theme.slug ? null : theme.slug))
                    }
                  >
                    <div className="bg-content3 relative h-16 w-full">
                      {theme.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          src={theme.image}
                        />
                      ) : (
                        <div className="text-default-400 flex h-full w-full items-center justify-center text-xl font-semibold">
                          {theme.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <span className="text-foreground block truncate text-xs font-medium">
                        {theme.name}
                      </span>
                      <span className="text-default-500 text-[11px]">{theme.recipeCount}</span>
                    </div>
                  </button>
                </li>
              );
            })}
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

      {/* Recipes grid (filtered to the selected theme when one is active) */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-foreground text-lg font-semibold">
            {t("recipes")} {shownRecipes.length > 0 ? `(${shownRecipes.length})` : ""}
          </h2>
          {isThemeFiltered ? (
            <button
              className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
              type="button"
              onClick={() => setSelectedThemeSlug(null)}
            >
              {themes.find((theme) => theme.slug === selectedThemeSlug)?.name ?? ""}
              <span aria-hidden className="ml-0.5">
                ✕
              </span>
            </button>
          ) : null}
        </div>

        {recipesLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-content2 aspect-[4/3] animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : shownRecipes.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-8 text-center">
            {t("noRecipes")}
          </p>
        ) : (
          <SocialRecipeGrid recipes={shownRecipes} />
        )}
      </section>
    </div>
  );
}
