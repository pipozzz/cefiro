"use client";

import { use } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { FollowButton } from "@/components/social/follow-button";
import { useQuery } from "@tanstack/react-query";

type Props = {
  params: Promise<{ handle: string }>;
};

type RecipeCard = {
  slug: string | null;
  name: string;
  description: string | null;
  image: string | null;
  dishColor: string | null;
  totalMinutes: number | null;
  publishedAt: Date | null;
};

function RecipeCardTile({ recipe }: { recipe: RecipeCard }) {
  if (!recipe.slug) {
    return null;
  }

  return (
    <Link
      href={`/r/${recipe.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-content1 shadow-sm ring-1 ring-default-100 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-content2">
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
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            {recipe.totalMinutes} min
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-foreground">{recipe.name}</h3>
        {recipe.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-default-500">{recipe.description}</p>
        ) : null}
      </div>
    </Link>
  );
}

function ProfileContent({ handle }: { handle: string }) {
  const trpc = useTRPC();

  const profileQuery = useQuery({
    ...trpc.social.getProfile.queryOptions({ handle }),
    retry: false,
  });

  const recipesQuery = useQuery({
    ...trpc.social.listProfileRecipes.queryOptions({ handle, limit: 24 }),
    retry: false,
    enabled: profileQuery.isSuccess,
  });

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse px-4 py-10 md:px-6">
        <div className="h-24 w-24 rounded-full bg-content2" />
        <div className="mt-4 h-6 w-48 rounded bg-content2" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <NotFoundView title="Profile not found" message="This profile is private or does not exist." />;
  }

  const { profile, counts } = profileQuery.data;
  const displayName = profile.displayName ?? `@${profile.handle}`;
  const recipes = recipesQuery.data?.recipes ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 md:px-6">
      {/* Profile header */}
      <header className="flex flex-col items-center gap-4 pt-10 text-center md:flex-row md:items-start md:text-left">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-2 ring-default-200"
          />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex-1">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">{displayName}</h1>
              <p className="text-default-500">@{profile.handle}</p>
            </div>
            <FollowButton handle={profile.handle} />
          </div>

          <div className="mt-3 flex items-center justify-center gap-5 text-sm md:justify-start">
            <span>
              <span className="font-semibold text-foreground">{counts.followers}</span>{" "}
              <span className="text-default-500">
                {counts.followers === 1 ? "follower" : "followers"}
              </span>
            </span>
            <span>
              <span className="font-semibold text-foreground">{counts.following}</span>{" "}
              <span className="text-default-500">following</span>
            </span>
          </div>

          {profile.bio ? (
            <p className="mt-3 max-w-2xl text-default-600">{profile.bio}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-default-500 md:justify-start">
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

      {/* Recipes grid */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Recipes {recipes.length > 0 ? `(${recipes.length})` : ""}
        </h2>

        {recipesQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-content2" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <p className="rounded-2xl bg-content2 p-8 text-center text-default-500">
            No public recipes yet.
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

export default function PublicProfilePage({ params }: Props) {
  const { handle } = use(params);

  return <ProfileContent handle={handle} />;
}
