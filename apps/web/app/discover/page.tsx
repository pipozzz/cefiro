"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { CookGrid } from "@/components/social/cook-card";
import { SocialProfileGrid } from "@/components/social/social-profile-card";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Spinner } from "@heroui/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type Sort = "newest" | "trending";
type Category = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type Mode = "recipes" | "cooks";

const CATEGORIES: Category[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function DiscoverPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("social.discover");
  const tCat = useTranslations("social.categories");

  const [mode, setMode] = useState<Mode>("recipes");
  const [sort, setSort] = useState<Sort>("newest");
  const [category, setCategory] = useState<Category | null>(null);
  const [tag, setTag] = useState<string | null>(() => searchParams.get("tag"));

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);

  // Debounce the input before hitting the API / URL.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);

    return () => clearTimeout(id);
  }, [q]);

  // Keep the URL in sync so a search / tag filter is shareable and survives
  // reload.
  useEffect(() => {
    const params = new URLSearchParams();
    const trimmed = debouncedQ.trim();

    if (trimmed) params.set("q", trimmed);
    if (tag) params.set("tag", tag);

    const query = params.toString();
    const next = query ? `/discover?${query}` : "/discover";

    if (`${window.location.pathname}${window.location.search}` !== next) {
      router.replace(next, { scroll: false });
    }
  }, [debouncedQ, tag, router]);

  const searchTerm = debouncedQ.trim();
  const isSearching = searchTerm.length >= 2;

  const browse = useInfiniteQuery({
    ...trpc.social.discover.infiniteQueryOptions(
      { sort, category: category ?? undefined, tag: tag ?? undefined, limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: !isSearching && mode === "recipes",
    retry: false,
  });

  const cooks = useInfiniteQuery({
    ...trpc.social.discoverCooks.infiniteQueryOptions(
      { limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: !isSearching && mode === "cooks",
    retry: false,
  });

  const cookList = cooks.data?.pages.flatMap((page) => page.cooks) ?? [];

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
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-default-500">{t("subtitle")}</p>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-default-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAria")}
          className="w-full rounded-full bg-content2 py-3 pl-12 pr-11 text-foreground outline-none ring-1 ring-transparent transition placeholder:text-default-400 focus:bg-content1 focus:ring-primary"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t("clearSearch")}
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
          {/* Recipes / Cooks toggle */}
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              className={pill(mode === "recipes")}
              onClick={() => setMode("recipes")}
            >
              {t("modeRecipes")}
            </button>
            <button
              type="button"
              className={pill(mode === "cooks")}
              onClick={() => setMode("cooks")}
            >
              {t("modeCooks")}
            </button>
          </div>

          {mode === "cooks" ? (
            cooks.isLoading ? (
              <div className="flex min-h-[30vh] items-center justify-center">
                <Spinner />
              </div>
            ) : cookList.length === 0 ? (
              <p className="rounded-2xl bg-content2 p-10 text-center text-default-500">
                {t("noCooks")}
              </p>
            ) : (
              <>
                <CookGrid cooks={cookList} />
                {cooks.hasNextPage ? (
                  <div className="mt-8 flex justify-center">
                    <Button
                      variant="tertiary"
                      onPress={() => cooks.fetchNextPage()}
                      isPending={cooks.isFetchingNextPage}
                    >
                      {t("loadMore")}
                    </Button>
                  </div>
                ) : null}
              </>
            )
          ) : (
            <>
          {/* Sort */}
          <div className="mb-3 flex gap-2">
            <button type="button" className={pill(sort === "newest")} onClick={() => setSort("newest")}>
              {t("sortNewest")}
            </button>
            <button
              type="button"
              className={pill(sort === "trending")}
              onClick={() => setSort("trending")}
            >
              {t("sortTrending")}
            </button>
          </div>

          {/* Category filter */}
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              className={pill(category === null)}
              onClick={() => setCategory(null)}
            >
              {t("categoryAll")}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={pill(category === cat)}
                onClick={() => setCategory(cat)}
              >
                {tCat(cat)}
              </button>
            ))}
          </div>

          {tag ? (
            <div className="mb-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary">
                #{tag}
                <button
                  type="button"
                  onClick={() => setTag(null)}
                  aria-label={t("clearTag")}
                  className="ml-0.5 rounded-full hover:text-danger"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            </div>
          ) : null}

          {browse.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Spinner />
            </div>
          ) : recipes.length === 0 ? (
            <p className="rounded-2xl bg-content2 p-10 text-center text-default-500">
              {t("empty")}
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
                    {t("loadMore")}
                  </Button>
                </div>
              ) : null}
            </>
          )}
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
  const t = useTranslations("social.discover");

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
        {t("noResults", { term })}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {profiles.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t("sectionPeople")}</h2>
          <SocialProfileGrid profiles={profiles} />
        </section>
      ) : null}

      {recipes.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t("sectionRecipes")}</h2>
          <SocialRecipeGrid recipes={recipes} />
        </section>
      ) : null}
    </div>
  );
}
