"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { Button, Spinner } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";

type Sort = "newest" | "trending";
type Category = "Breakfast" | "Lunch" | "Dinner" | "Snack";

const CATEGORIES: Category[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function DiscoverPage() {
  const trpc = useTRPC();
  const [sort, setSort] = useState<Sort>("newest");
  const [category, setCategory] = useState<Category | null>(null);

  const query = useInfiniteQuery({
    ...trpc.social.discover.infiniteQueryOptions(
      { sort, category: category ?? undefined, limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    retry: false,
  });

  const recipes = query.data?.pages.flatMap((page) => page.recipes) ?? [];

  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active ? "bg-primary text-primary-foreground" : "bg-content2 text-default-600 hover:bg-content3"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Discover</h1>
        <p className="text-default-500">Explore recipes shared by the community.</p>
      </header>

      {/* Sort */}
      <div className="mb-3 flex gap-2">
        <button type="button" className={pill(sort === "newest")} onClick={() => setSort("newest")}>
          Newest
        </button>
        <button
          type="button"
          className={pill(sort === "trending")}
          onClick={() => setSort("trending")}
        >
          🔥 Trending
        </button>
      </div>

      {/* Category filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button type="button" className={pill(category === null)} onClick={() => setCategory(null)}>
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={pill(category === cat)}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <p className="rounded-2xl bg-content2 p-10 text-center text-default-500">
          No public recipes here yet.
        </p>
      ) : (
        <>
          <SocialRecipeGrid recipes={recipes} />

          {query.hasNextPage ? (
            <div className="mt-8 flex justify-center">
              <Button
                variant="tertiary"
                onPress={() => query.fetchNextPage()}
                isPending={query.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
