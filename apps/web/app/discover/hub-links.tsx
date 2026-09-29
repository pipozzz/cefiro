import { cache } from "react";
import Link from "next/link";
import { ALL_CATEGORIES, categorySlug } from "@/lib/recipe-categories";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";

import { listPublicCuisines } from "@norish/db/repositories/cuisines";
import { listTrendingTopics } from "@norish/db/repositories/follows";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";

// Keep the landing footer scannable: link the most-used tags here, with the full
// list one hop away at /discover/tag.
const TOP_TAGS = 24;

/** Cuisines with public recipes, most-used first. Never throws. */
const loadCuisines = cache(async () => {
  try {
    return await listPublicCuisines();
  } catch {
    return [];
  }
});

/** Most-used tags with public recipes. Never throws. */
const loadTopTags = cache(async () => {
  try {
    return await listTrendingTopics(TOP_TAGS);
  } catch {
    return [];
  }
});

const chip =
  "bg-content2 hover:bg-content3 text-default-600 hover:text-foreground rounded-full px-4 py-1.5 text-sm no-underline transition";

/**
 * Crawlable internal links from the discovery landing to the SSR cuisine,
 * category and tag hub pages (and their spokes).
 *
 * The discovery grid is a client surface whose filter chips do not change the
 * URL, so without these a crawler reaching /discover would only find the hub
 * pages through the sitemap. Real server-rendered <Link>s give those hubs the
 * internal links that make them rank, and give readers a way in. Rendered by the
 * server page so the links are always in the initial HTML.
 *
 * Placed near the top of discovery (under the search bar): the grid is an
 * infinite scroll, so a footer block would be unreachable in practice — most
 * readers would never scroll past the recipes to find it.
 *
 * Collapsed by default (a native <details>) so it stays a single line and does
 * not push the recipes down; the full link set is still in the DOM when closed,
 * so crawlers read it and SEO is unaffected. Readers expand it on demand.
 */
export async function DiscoverHubLinks() {
  const t = await getTranslations("social.discover");
  const tCat = await getTranslations("social.categories");
  const cuisines = await loadCuisines();
  const tags = await loadTopTags();

  return (
    <details className="border-border group mb-8 rounded-2xl border p-4 md:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold tracking-wide uppercase [&::-webkit-details-marker]:hidden">
        <span>{t("browseHeading")}</span>
        <ChevronDownIcon className="text-default-500 h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase">
          <Link className="text-foreground hover:underline" href="/discover/category">
            {t("browseByCategory")}
          </Link>
        </h3>
        <ul className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((category) => (
            <li key={category}>
              <Link className={chip} href={`/discover/category/${categorySlug(category)}`}>
                {tCat(category)}
              </Link>
            </li>
          ))}
        </ul>

        {cuisines.length > 0 ? (
          <>
            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide uppercase">
              <Link className="text-foreground hover:underline" href="/discover/cuisine">
                {t("browseByCuisine")}
              </Link>
            </h3>
            <ul className="flex flex-wrap gap-2">
              {cuisines.map((cuisine) => (
                <li key={cuisine.name}>
                  <Link className={chip} href={`/discover/cuisine/${cuisineSlug(cuisine.name)}`}>
                    {cuisine.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {tags.length > 0 ? (
          <>
            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide uppercase">
              <Link className="text-foreground hover:underline" href="/discover/tag">
                {t("browseByTag")}
              </Link>
            </h3>
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.name}>
                  <Link className={chip} href={`/discover/tag/${cuisineSlug(tag.name)}`}>
                    #{tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
