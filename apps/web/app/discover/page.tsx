"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialProfileGrid } from "@/components/social/social-profile-card";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Spinner } from "@heroui/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

type Sort = "newest" | "trending";
type Category = "Breakfast" | "Lunch" | "Dinner" | "Snack";

const CATEGORIES: Category[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function DiscoverPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sort, setSort] = useState<Sort>("newest");
  const [category, setCategory] = useState<Category | null>(null);

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);

  // Debounce the input before hitting the API / URL.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);

    return () => clearTimeout(id);
  }, [q]);

  // Keep the URL in sync so a search is shareable and survives reload.
  useEffect(() => {
    const trimmed = debouncedQ.trim();
    const next = trimmed ? `/discover?q=${encodeURIComponent(trimmed)}` : "/discover";

    if (`${window.location.pathname}${window.location.search}` !== next) {
      router.replace(next, { scroll: false });
    }
  }, [debouncedQ, router]);

  const searchTerm = debouncedQ.trim();
  const isSearching = searchTerm.length >= 2;

  const browse = useInfiniteQuery({
    ...trpc.social.discover.infiniteQueryOptions(
      { sort, category: category ?? undefined, limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: !isSearching,
    retry: false,
  });

  const searchQuery = useQuery({
    ...trpc.social.search.queryOptions({ q: searchTerm, limit: 24 }),
    enabled: isSearching,
    retry: false,
  });

  const recipes = browse.data?.pages.flatMap((page) => page.recipes) ?? [];

  const pill = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active ? "bg-primary text-primary-foreground" : "bg-content2 text-default-600 hover:bg-content3"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Discover</h1>
        <p className="text-default-500">Explore recipes and cooks shared by the community.</p>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-default-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes and people…"
          aria-label="Search recipes and people"
          className="w-full rounded-full bg-content2 py-3 pl-12 pr-11 text-foreground outline-none ring-1 ring-transparent transition placeholder:text-default-400 focus:bg-content1 focus:ring-primary"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-default-400 hover:text-foreground"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {isSearching ? (
        <SearchResults query={searchQuery} term={searchTerm} />
      ) : (
        <>
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
            <button
              type="button"
              className={pill(category === null)}
              onClick={() => setCategory(null)}
            >
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

          {browse.isLoading ? (
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

              {browse.hasNextPage ? (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="tertiary"
                    onPress={() => browse.fetchNextPage()}
                    isPending={browse.isFetchingNextPage}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

type SearchData = {
  recipes: React.ComponentProps<typeof SocialRecipeGrid>["recipes"];
  profiles: React.ComponentProps<typeof SocialProfileGrid>["profiles"];
};

function SearchResults({
  query,
  term,
}: {
  query: { data?: SearchData; isLoading: boolean };
  term: string;
}) {
  if (query.isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const profiles = query.data?.profiles ?? [];
  const recipes = query.data?.recipes ?? [];

  if (profiles.length === 0 && recipes.length === 0) {
    return (
      <p className="rounded-2xl bg-content2 p-10 text-center text-default-500">
        No results for “{term}”.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {profiles.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">People</h2>
          <SocialProfileGrid profiles={profiles} />
        </section>
      ) : null}

      {recipes.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Recipes</h2>
          <SocialRecipeGrid recipes={recipes} />
        </section>
      ) : null}
    </div>
  );
}
