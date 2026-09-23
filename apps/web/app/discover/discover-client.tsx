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
import { Button, Input, Spinner } from "@heroui/react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { DietaryFilterToggle } from "./dietary-filter-toggle";
import { IngredientDiscovery } from "./ingredient-discovery";
import { RecipeOfTheDay } from "./recipe-of-the-day";
import { SurpriseDiscovery } from "./surprise-discovery";
import { TrendingTopics } from "./trending-topics";

type Sort = "newest" | "trending";
type Category = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type Mode = "recipes" | "byIngredient" | "surprise" | "cooks" | "cookbooks";

const CATEGORIES: Category[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const TIME_OPTIONS = [15, 30, 60] as const;

export function DiscoverClient({ isAuthed }: { isAuthed: boolean }) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const t = useTranslations("social.discover");
  const tCat = useTranslations("social.categories");

  const [mode, setMode] = useState<Mode>("recipes");
  const [sort, setSort] = useState<Sort>("newest");
  const [category, setCategory] = useState<Category | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [hideMyAllergens, setHideMyAllergens] = useState(false);
  const [tag, setTag] = useState<string | null>(() => searchParams.get("tag"));

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

    const query = params.toString();
    const next = query ? `/discover?${query}` : "/discover";

    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [debouncedQ, tag]);

  const searchTerm = debouncedQ.trim();
  const isSearching = searchTerm.length >= 2;

  const browse = useInfiniteQuery({
    ...trpc.social.discover.infiniteQueryOptions(
      {
        sort,
        category: category ?? undefined,
        tag: tag ?? undefined,
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

  const searchQuery = useQuery({
    ...trpc.social.search.queryOptions({ q: searchTerm, limit: 24 }),
    enabled: isSearching,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const recipes = browse.data?.pages.flatMap((page) => page.recipes) ?? [];

  // Active uses the brand accent (a solid green fill + white text), not the
  // theme's pale `primary`, so the selected chip is unmistakable; inactive is a
  // bordered light pill so unselected chips still read as chips rather than
  // plain text. The accent is referenced by CSS var so it always renders.
  const pill = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
      active
        ? "border-transparent bg-[var(--accent)] text-white shadow-sm"
        : "border-border bg-content2 text-default-600 hover:bg-content3"
    }`;

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

      {isSearching ? (
        <SearchResults isAuthed={isAuthed} query={searchQuery} term={searchTerm} />
      ) : (
        <>
          {/* Recipes / Cooks toggle */}
          <div className="mb-6 flex gap-2">
            <button
              className={pill(mode === "recipes")}
              type="button"
              onClick={() => setMode("recipes")}
            >
              {t("modeRecipes")}
            </button>
            <button
              className={pill(mode === "byIngredient")}
              type="button"
              onClick={() => setMode("byIngredient")}
            >
              {t("modeByIngredient")}
            </button>
            <button
              className={pill(mode === "surprise")}
              type="button"
              onClick={() => setMode("surprise")}
            >
              {t("modeSurprise")}
            </button>
            <button
              className={pill(mode === "cooks")}
              type="button"
              onClick={() => setMode("cooks")}
            >
              {t("modeCooks")}
            </button>
            <button
              className={pill(mode === "cookbooks")}
              type="button"
              onClick={() => setMode("cookbooks")}
            >
              {t("modeCookbooks")}
            </button>
          </div>

          {mode === "byIngredient" ? (
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
                {cookbooks.hasNextPage ? (
                  <div className="mt-8 flex justify-center">
                    <Button
                      isPending={cookbooks.isFetchingNextPage}
                      variant="tertiary"
                      onPress={() => cookbooks.fetchNextPage()}
                    >
                      {t("loadMore")}
                    </Button>
                  </div>
                ) : null}
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
                {cooks.hasNextPage ? (
                  <div className="mt-8 flex justify-center">
                    <Button
                      isPending={cooks.isFetchingNextPage}
                      variant="tertiary"
                      onPress={() => cooks.fetchNextPage()}
                    >
                      {t("loadMore")}
                    </Button>
                  </div>
                ) : null}
              </>
            )
          ) : (
            <>
              {/* Recipe of the day: a curated daily hero, shown only on the
                  default landing (no active filter) so it never competes with a
                  narrowed result set. */}
              {!category && !tag && !maxMinutes ? <RecipeOfTheDay /> : null}

              {/* Sort */}
              <div className="mb-3 flex gap-2">
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
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={pill(category === cat)}
                    type="button"
                    onClick={() => setCategory(cat)}
                  >
                    {tCat(cat)}
                  </button>
                ))}
              </div>

              {/* Trending topics: most-used public tags, as a shortcut into the
                  tag filter. Hidden while a tag is already active so it doesn't
                  compete with the active-tag chip below. */}
              {tag ? null : <TrendingTopics activeTag={tag} onSelect={setTag} />}

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
                <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
                  {t("empty")}
                </p>
              ) : (
                <>
                  <SocialRecipeGrid recipes={recipes} />

                  {browse.hasNextPage ? (
                    <div className="mt-8 flex justify-center">
                      <Button
                        isPending={browse.isFetchingNextPage}
                        variant="tertiary"
                        onPress={() => browse.fetchNextPage()}
                      >
                        {t("loadMore")}
                      </Button>
                    </div>
                  ) : null}
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
