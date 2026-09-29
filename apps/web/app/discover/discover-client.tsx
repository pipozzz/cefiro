"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import RecipeCard from "@/components/dashboard/recipe-card";
import { CookGrid } from "@/components/social/cook-card";
import { SocialCookbookGrid } from "@/components/social/social-cookbook-card";
import { SocialProfileGrid } from "@/components/social/social-profile-card";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { SuggestedCooks } from "@/components/social/suggested-cooks";
import { useRecipesContext } from "@/context/recipes-context";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Input, Spinner } from "@heroui/react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { DietaryFilterToggle } from "./dietary-filter-toggle";
import { DiscoverThemes } from "./discover-themes";
import { IngredientDiscovery } from "./ingredient-discovery";
import { LoadMoreSentinel } from "./load-more-sentinel";
import { RecipeOfTheDay } from "./recipe-of-the-day";
import { SurpriseDiscovery } from "./surprise-discovery";

type Sort = "newest" | "trending";
type Category = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type Mode =
  "forYou" | "recipes" | "following" | "byIngredient" | "surprise" | "cooks" | "cookbooks";

const CATEGORIES: Category[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const TIME_OPTIONS = [15, 30, 60] as const;
// Cuisine is an open vocabulary; cap the facet row so it never dominates.
const MAX_CUISINE_CHIPS = 12;

// Active uses the brand accent (a solid green fill + white text), not the
// theme's pale `primary`, so the selected chip is unmistakable; inactive is a
// bordered light pill so unselected chips still read as chips rather than plain
// text. The accent is referenced by CSS var so it always renders.
const pillClass = (active: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
    active
      ? "border-transparent bg-[var(--accent)] text-white shadow-sm"
      : "border-border bg-content2 text-default-600 hover:bg-content3"
  }`;

export function DiscoverClient({
  hubLinks,
  isAuthed,
}: {
  hubLinks?: React.ReactNode;
  isAuthed: boolean;
}) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const t = useTranslations("social.discover");
  const tCat = useTranslations("social.categories");
  const tFeed = useTranslations("social.feed");

  // Signed-in readers land on their personalised "For you" feed; visitors get the
  // generic community browse. But a shared link that carries a filter
  // (tag/cuisine/category) opens the browse lens so that filter is actually
  // applied rather than hidden under "For you".
  const [mode, setMode] = useState<Mode>(() => {
    if (searchParams.get("tag") || searchParams.get("cuisine") || searchParams.get("category")) {
      return "recipes";
    }

    return isAuthed ? "forYou" : "recipes";
  });
  const [sort, setSort] = useState<Sort>("newest");
  const [category, setCategory] = useState<Category | null>(() => {
    const initial = searchParams.get("category");

    return initial && (CATEGORIES as string[]).includes(initial) ? (initial as Category) : null;
  });
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [hideMyAllergens, setHideMyAllergens] = useState(false);
  const [tag, setTag] = useState<string | null>(() => searchParams.get("tag"));
  // A selected cuisine facet (matched by name, case-insensitive server-side).
  // Seeded from the URL so a shared /discover?cuisine=… link restores the filter.
  const [cuisine, setCuisine] = useState<string | null>(() => searchParams.get("cuisine"));
  // A selected semantic theme (Phase B): its own vector-search results view,
  // exclusive with the tag/category/time filters.
  const [theme, setTheme] = useState<{ id: string; name: string } | null>(null);

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);

  // Debounce the input before hitting the API / URL.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);

    return () => clearTimeout(id);
  }, [q]);

  // Keep the URL in sync so a search / tag filter is shareable and survives
  // reload. Use history.replaceState rather than router.replace: this page is a
  // server component under an auth-adaptive layout, so a router navigation on
  // every keystroke would re-run the server render (session read + shell) and
  // flash the whole page. The URL bar still updates; the initial values are
  // read from the query string on load, so shareability is unaffected.
  useEffect(() => {
    const params = new URLSearchParams();
    const trimmed = debouncedQ.trim();

    if (trimmed) params.set("q", trimmed);
    if (tag) params.set("tag", tag);
    if (cuisine) params.set("cuisine", cuisine);
    if (category) params.set("category", category);

    const query = params.toString();
    const next = query ? `/discover?${query}` : "/discover";

    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [debouncedQ, tag, cuisine, category]);

  const searchTerm = debouncedQ.trim();
  const isSearching = searchTerm.length >= 2;

  const browse = useInfiniteQuery({
    ...trpc.social.discover.infiniteQueryOptions(
      {
        sort,
        category: category ?? undefined,
        tag: tag ?? undefined,
        cuisine: cuisine ?? undefined,
        maxMinutes: maxMinutes ?? undefined,
        hideMyAllergens: hideMyAllergens || undefined,
        limit: 24,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: !isSearching && mode === "recipes",
    // Changing sort/category/tag/time makes a new query key; without this the
    // grid would blank to a spinner on every filter tap (a flicker, and the
    // page width jumps as the scrollbar comes and goes). Keep the previous
    // results on screen while the next set loads.
    placeholderData: keepPreviousData,
    retry: false,
  });

  // Category facet counts, under the active tag / time / dietary filters, so each
  // category chip can show how many recipes it holds. Only the browse lens uses
  // the chips, so it is the only place this runs.
  const categoryCounts = useQuery({
    ...trpc.social.discoverCategoryCounts.queryOptions({
      tag: tag ?? undefined,
      maxMinutes: maxMinutes ?? undefined,
      hideMyAllergens: hideMyAllergens || undefined,
    }),
    enabled: !isSearching && mode === "recipes",
    placeholderData: keepPreviousData,
    retry: false,
  });
  const counts = categoryCounts.data;

  // Cuisine facet counts, under the same tag / time / dietary filters (but not the
  // selected cuisine itself — so the reader can switch between cuisines and still
  // see each one's size). Drives the cuisine chip row.
  const cuisineCounts = useQuery({
    ...trpc.social.discoverCuisineCounts.queryOptions({
      tag: tag ?? undefined,
      maxMinutes: maxMinutes ?? undefined,
      hideMyAllergens: hideMyAllergens || undefined,
    }),
    enabled: !isSearching && mode === "recipes",
    placeholderData: keepPreviousData,
    retry: false,
  });
  // Cuisines that currently have matching recipes, most first (the proc orders
  // them). Cap the row so a long vocabulary doesn't dominate; always keep the
  // selected cuisine visible even if it falls outside the top slice.
  const cuisineList = cuisineCounts.data;
  const visibleCuisines = (() => {
    if (!cuisineList) return [] as string[];

    const names = Object.keys(cuisineList.byCuisine);
    const top = names.slice(0, MAX_CUISINE_CHIPS);

    if (cuisine && !top.includes(cuisine)) {
      top.push(cuisine);
    }

    return top;
  })();

  const cooks = useInfiniteQuery({
    ...trpc.social.discoverCooks.infiniteQueryOptions(
      { limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: !isSearching && mode === "cooks",
    retry: false,
  });

  const cookList = cooks.data?.pages.flatMap((page) => page.cooks) ?? [];

  const cookbooks = useInfiniteQuery({
    ...trpc.social.discoverCookbooks.infiniteQueryOptions(
      { limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: !isSearching && mode === "cookbooks",
    retry: false,
  });

  const cookbookList = cookbooks.data?.pages.flatMap((page) => page.cookbooks) ?? [];

  // "For you" — the personalised default for signed-in readers: recipes from
  // the cooks they follow blended with the best of the community, dietary-filtered
  // server-side. Falls back gracefully to the community's newest when they follow
  // nobody yet, so it is never empty on a young platform.
  const forYou = useInfiniteQuery({
    ...trpc.social.forYou.infiniteQueryOptions(
      { limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: isAuthed && !isSearching && mode === "forYou",
    retry: false,
  });

  const forYouRecipes = forYou.data?.pages.flatMap((page) => page.recipes) ?? [];
  const forYouEmpty = !forYou.isLoading && forYouRecipes.length === 0;

  // Defensive cold-start: even though the "For you" query itself falls back to
  // the community's newest, a reader whose dietary profile filters everything (or
  // a truly empty platform) could still get nothing. Rather than show a bare
  // "empty" state — which reads as "the whole site is empty" — fill it with
  // trending public recipes so there is always something to explore.
  const forYouPopular = useQuery({
    ...trpc.social.discover.queryOptions({ sort: "trending", limit: 12 }),
    enabled: mode === "forYou" && forYouEmpty,
    retry: false,
  });

  const forYouPopularRecipes = forYouPopular.data?.recipes ?? [];

  // "Following" — the former standalone feed, now a discover tab: public
  // recipes from people the signed-in user follows.
  const following = useInfiniteQuery({
    ...trpc.social.feed.infiniteQueryOptions(
      { limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    enabled: isAuthed && !isSearching && mode === "following",
    retry: false,
  });

  const followingRecipes = following.data?.pages.flatMap((page) => page.recipes) ?? [];
  const followingEmpty = !following.isLoading && followingRecipes.length === 0;

  // Cold-start (following nobody yet): trending public recipes so the tab still
  // has real content rather than just a nudge — mirrors the old feed page.
  const followingPopular = useQuery({
    ...trpc.social.discover.queryOptions({ sort: "trending", limit: 12 }),
    enabled: mode === "following" && followingEmpty,
    retry: false,
  });

  const followingPopularRecipes = followingPopular.data?.recipes ?? [];

  const searchQuery = useQuery({
    ...trpc.social.search.queryOptions({ q: searchTerm, limit: 24 }),
    enabled: isSearching,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const recipes = browse.data?.pages.flatMap((page) => page.recipes) ?? [];

  const pill = pillClass;

  // The mode tabs stay visible during a search (so they never vanish mid-query).
  // Picking one is a request to browse, so it also clears the search term —
  // otherwise the search results would linger under the newly selected tab.
  const selectMode = (next: Mode) => {
    setQ("");
    setDebouncedQ("");
    setMode(next);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-6">
      <header className="mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("title")}</h1>
        <p className="text-default-500">{t("subtitle")}</p>
      </header>

      {/* Search — same field styling as the Library search input */}
      <div className="relative mb-6 w-full">
        <MagnifyingGlassIcon className="text-muted pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2" />
        <Input
          fullWidth
          aria-label={t("searchAria")}
          className="bg-field shadow-field focus-visible:border-accent/60 focus-visible:ring-accent/20 h-12 rounded-full border border-transparent text-[15px] transition-colors outline-none focus-visible:ring-2"
          placeholder={t("searchPlaceholder")}
          style={{
            fontSize: "16px",
            paddingLeft: "2.75rem",
            paddingRight: q.length > 0 ? "2.75rem" : "1rem",
          }}
          value={q}
          variant="primary"
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <button
            aria-label={t("clearSearch")}
            className="text-muted hover:bg-surface-secondary hover:text-foreground absolute top-1/2 right-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            type="button"
            onClick={() => setQ("")}
            onMouseDown={(e) => e.preventDefault()}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Hero — the crawlable browse-by hubs, dynamic themes and the daily pick.
          Hidden while searching so the results lead. The hubs sit at the top
          because the browse grid below is an infinite scroll, so a footer block
          would never be reached. Themes stay mounted across category/time/tag
          clicks (gating them on the active filter made the whole block
          mount/unmount and refetch on every tap, a full-page flicker); a
          selected theme opens its own results, so they hide only then. */}
      {!isSearching ? (
        <>
          {hubLinks}

          {mode !== "cooks" && mode !== "cookbooks" && !theme ? (
            <>
              <DiscoverThemes
                onQuick={() => {
                  setMaxMinutes(30);
                  setMode("recipes");
                }}
                onSelectTag={(next) => {
                  setTag(next);
                  setMode("recipes");
                }}
                onSelectTheme={(next) => {
                  setTheme(next);
                  setMode("recipes");
                }}
              />
              <RecipeOfTheDay />
            </>
          ) : null}
        </>
      ) : null}

      {/* Recipes / Cooks toggle — kept visible even during a search, so the
          filters never vanish mid-query; tapping one clears the search. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {isAuthed ? (
          <button
            className={pill(mode === "forYou")}
            type="button"
            onClick={() => selectMode("forYou")}
          >
            {t("modeForYou")}
          </button>
        ) : null}
        <button
          className={pill(mode === "recipes")}
          type="button"
          onClick={() => selectMode("recipes")}
        >
          {t("modeRecipes")}
        </button>
        {isAuthed ? (
          <button
            className={pill(mode === "following")}
            type="button"
            onClick={() => selectMode("following")}
          >
            {t("modeFollowing")}
          </button>
        ) : null}
        <button
          className={pill(mode === "byIngredient")}
          type="button"
          onClick={() => selectMode("byIngredient")}
        >
          {t("modeByIngredient")}
        </button>
        <button
          className={pill(mode === "surprise")}
          type="button"
          onClick={() => selectMode("surprise")}
        >
          {t("modeSurprise")}
        </button>
        <button
          className={pill(mode === "cooks")}
          type="button"
          onClick={() => selectMode("cooks")}
        >
          {t("modeCooks")}
        </button>
        <button
          className={pill(mode === "cookbooks")}
          type="button"
          onClick={() => selectMode("cookbooks")}
        >
          {t("modeCookbooks")}
        </button>
      </div>

      {isSearching ? (
        <SearchResults isAuthed={isAuthed} query={searchQuery} term={searchTerm} />
      ) : mode === "forYou" ? (
        forYou.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner />
          </div>
        ) : forYouRecipes.length === 0 ? (
          <div className="space-y-8">
            <SuggestedCooks />

            {forYouPopularRecipes.length > 0 ? (
              <section>
                <h2 className="text-foreground mb-4 text-lg font-semibold">
                  {tFeed("popularTitle")}
                </h2>
                <SocialRecipeGrid recipes={forYouPopularRecipes} />
              </section>
            ) : (
              <div className="bg-content2 rounded-2xl p-10 text-center">
                <p className="text-default-600">{t("empty")}</p>
                <p className="text-default-500 mt-1 text-sm">{t("emptyColdStart")}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <SocialRecipeGrid recipes={forYouRecipes} />
            <LoadMoreSentinel
              hasNextPage={forYou.hasNextPage}
              isFetchingNextPage={forYou.isFetchingNextPage}
              onLoadMore={() => forYou.fetchNextPage()}
            />
            <div className="mt-12">
              <SuggestedCooks limit={6} />
            </div>
          </>
        )
      ) : mode === "following" ? (
        following.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner />
          </div>
        ) : followingEmpty ? (
          <div className="space-y-8">
            <div className="bg-content2 rounded-2xl p-10 text-center">
              <p className="text-default-600">{tFeed("emptyTitle")}</p>
              <p className="text-default-500 mt-1 text-sm">{tFeed("emptyBody")}</p>
            </div>

            <SuggestedCooks />

            {followingPopularRecipes.length > 0 ? (
              <section>
                <h2 className="text-foreground mb-4 text-lg font-semibold">
                  {tFeed("popularTitle")}
                </h2>
                <SocialRecipeGrid recipes={followingPopularRecipes} />
              </section>
            ) : null}
          </div>
        ) : (
          <>
            <SocialRecipeGrid recipes={followingRecipes} />
            <LoadMoreSentinel
              hasNextPage={following.hasNextPage}
              isFetchingNextPage={following.isFetchingNextPage}
              onLoadMore={() => following.fetchNextPage()}
            />
          </>
        )
      ) : mode === "byIngredient" ? (
        <IngredientDiscovery />
      ) : mode === "surprise" ? (
        <SurpriseDiscovery />
      ) : mode === "cookbooks" ? (
        cookbooks.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner />
          </div>
        ) : cookbookList.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
            {t("noCookbooks")}
          </p>
        ) : (
          <>
            <SocialCookbookGrid cookbooks={cookbookList} />
            <LoadMoreSentinel
              hasNextPage={cookbooks.hasNextPage}
              isFetchingNextPage={cookbooks.isFetchingNextPage}
              onLoadMore={() => cookbooks.fetchNextPage()}
            />
          </>
        )
      ) : mode === "cooks" ? (
        cooks.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner />
          </div>
        ) : cookList.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
            {t("noCooks")}
          </p>
        ) : (
          <>
            <CookGrid cooks={cookList} />
            <LoadMoreSentinel
              hasNextPage={cooks.hasNextPage}
              isFetchingNextPage={cooks.isFetchingNextPage}
              onLoadMore={() => cooks.fetchNextPage()}
            />
          </>
        )
      ) : theme ? (
        <ThemeResults theme={theme} onClear={() => setTheme(null)} />
      ) : (
        <>
          {/* Sort */}
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              className={pill(sort === "newest")}
              type="button"
              onClick={() => setSort("newest")}
            >
              {t("sortNewest")}
            </button>
            <button
              className={pill(sort === "trending")}
              type="button"
              onClick={() => setSort("trending")}
            >
              {t("sortTrending")}
            </button>
          </div>

          {/* "Ready in" time filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-default-500 mr-1 text-sm">{t("readyInHeading")}</span>
            <button
              className={pill(maxMinutes === null)}
              type="button"
              onClick={() => setMaxMinutes(null)}
            >
              {t("readyInAny")}
            </button>
            {TIME_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                className={pill(maxMinutes === minutes)}
                type="button"
                onClick={() => setMaxMinutes(minutes)}
              >
                {t("readyInUnder", { minutes })}
              </button>
            ))}

            {/* Dietary-aware: hide recipes with the signed-in reader's
                    allergens. Renders nothing for anon or allergen-free cooks. */}
            {isAuthed ? (
              <DietaryFilterToggle enabled={hideMyAllergens} onChange={setHideMyAllergens} />
            ) : null}
          </div>

          {/* Category filter */}
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              className={pill(category === null)}
              type="button"
              onClick={() => setCategory(null)}
            >
              {t("categoryAll")}
              {counts ? <span className="opacity-70"> {counts.total}</span> : null}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={pill(category === cat)}
                type="button"
                onClick={() => setCategory(cat)}
              >
                {tCat(cat)}
                {counts ? <span className="opacity-70"> {counts.byCategory[cat] ?? 0}</span> : null}
              </button>
            ))}
          </div>

          {/* Cuisine facet — data-driven, most-populated first. Only shown once
              there are cuisines to offer under the current filters. */}
          {visibleCuisines.length > 0 ? (
            <div className="mb-8 flex flex-wrap items-center gap-2">
              <span className="text-default-500 mr-1 text-sm">{t("cuisineHeading")}</span>
              <button
                className={pill(cuisine === null)}
                type="button"
                onClick={() => setCuisine(null)}
              >
                {t("cuisineAll")}
              </button>
              {visibleCuisines.map((name) => (
                <button
                  key={name}
                  className={pill(cuisine === name)}
                  type="button"
                  onClick={() => setCuisine((prev) => (prev === name ? null : name))}
                >
                  {name}
                  {cuisineList ? (
                    <span className="opacity-70"> {cuisineList.byCuisine[name] ?? 0}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {tag ? (
            <div className="mb-6 flex items-center gap-2">
              <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium">
                #{tag}
                <button
                  aria-label={t("clearTag")}
                  className="hover:text-danger ml-0.5 rounded-full"
                  type="button"
                  onClick={() => setTag(null)}
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
            <div className="bg-content2 flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
              <SparklesIcon className="text-default-400 h-8 w-8" />
              <p className="text-foreground font-medium">{t("empty")}</p>
              <p className="text-default-500 text-sm">
                {!category && !tag && !cuisine && !maxMinutes
                  ? t("emptyColdStart")
                  : t("emptyFiltered")}
              </p>
            </div>
          ) : (
            <>
              <SocialRecipeGrid recipes={recipes} />

              <LoadMoreSentinel
                hasNextPage={browse.hasNextPage}
                isFetchingNextPage={browse.isFetchingNextPage}
                onLoadMore={() => browse.fetchNextPage()}
              />
            </>
          )}

          {/* Personalised "cooks to follow" for signed-in readers, so the
                  discover page also helps them grow their feed. Renders nothing
                  for anonymous readers or when there are no suggestions. */}
          {isAuthed ? (
            <div className="mt-12">
              <SuggestedCooks limit={6} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * A semantic theme's results: public recipes nearest the cluster's centroid,
 * most similar first (`social.themeRecipes`). This is the Phase B payoff —
 * recipes surfaced by meaning, not by a shared tag — so it deliberately shows
 * the community recipe grid without the tag/time/category filters, plus a way
 * back to the landing.
 */
function ThemeResults({
  theme,
  onClear,
}: {
  theme: { id: string; name: string };
  onClear: () => void;
}) {
  const t = useTranslations("social.discover");
  const trpc = useTRPC();

  const query = useQuery({
    ...trpc.social.themeRecipes.queryOptions({ themeId: theme.id, limit: 24 }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const recipes = query.data?.recipes ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button className={pillClass(false)} type="button" onClick={onClear}>
          ← {t("themeBack")}
        </button>
        <h2 className="text-foreground text-lg font-semibold">{theme.name}</h2>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">{t("empty")}</p>
      ) : (
        <SocialRecipeGrid recipes={recipes} />
      )}
    </div>
  );
}

type SearchData = {
  recipes: React.ComponentProps<typeof SocialRecipeGrid>["recipes"];
  profiles: React.ComponentProps<typeof SocialProfileGrid>["profiles"];
};

function SearchResults({
  isAuthed,
  query,
  term,
}: {
  isAuthed: boolean;
  query: { data?: SearchData; isLoading: boolean };
  term: string;
}) {
  const t = useTranslations("social.discover");
  const trpc = useTRPC();

  const profiles = query.data?.profiles ?? [];
  const recipes = query.data?.recipes ?? [];

  // The signed-in reader searches one box across both their own library and the
  // community. The library query lives here (it needs no recipes context) so
  // this component knows whether there are any own matches — which the empty
  // state below depends on. Anonymous readers skip it entirely.
  const ownQuery = useQuery({
    ...trpc.library.list.queryOptions({ search: term, limit: 12, type: "recipes" }),
    enabled: isAuthed,
    retry: false,
  });
  const ownRecipes = (ownQuery.data?.items ?? []).flatMap((item) =>
    item.kind === "recipe" ? [item.recipe] : []
  );

  const loading = query.isLoading || (isAuthed && ownQuery.isLoading);
  // Nothing anywhere — the honest empty state, for members and visitors alike.
  const nothingFound =
    !loading && profiles.length === 0 && recipes.length === 0 && ownRecipes.length === 0;

  return (
    <div className="space-y-10">
      {isAuthed && ownRecipes.length > 0 ? <YourRecipesResults recipes={ownRecipes} /> : null}

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {profiles.length > 0 ? (
            <section>
              <h2 className="text-foreground mb-4 text-lg font-semibold">{t("sectionPeople")}</h2>
              <SocialProfileGrid profiles={profiles} />
            </section>
          ) : null}

          {recipes.length > 0 ? (
            <section>
              <h2 className="text-foreground mb-4 text-lg font-semibold">
                {t("sectionCommunityRecipes")}
              </h2>
              <SocialRecipeGrid recipes={recipes} />
            </section>
          ) : null}
        </>
      )}

      {nothingFound ? (
        <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          {t("noResults", { term })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A signed-in reader's own recipes that match the discovery search. Rendered
 * only when authenticated (so it runs under the app shell's providers) and only
 * when there are matches — the parent owns the query and the empty state. It
 * reuses the library card and its favourite/delete wiring, and links to the
 * private `/recipes/[id]` view rather than the public `/r/[slug]` one.
 */
function YourRecipesResults({
  recipes,
}: {
  recipes: React.ComponentProps<typeof RecipeCard>["recipe"][];
}) {
  const t = useTranslations("social.discover");
  const { isFavorite, toggleFavorite, deleteRecipe, allergies } = useRecipesContext();

  return (
    <section>
      <h2 className="text-foreground mb-4 text-lg font-semibold">{t("sectionYourRecipes")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            allergies={allergies}
            isFavorite={isFavorite(recipe.id)}
            recipe={recipe}
            variant="grid"
            onDelete={deleteRecipe}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
