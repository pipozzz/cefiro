import { cache } from "react";
import Link from "next/link";
import { ALL_CATEGORIES, categorySlug } from "@/lib/recipe-categories";
import { getTranslations } from "next-intl/server";

import { listPublicCuisines } from "@norish/db/repositories/cuisines";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";

/** Cuisines with public recipes, most-used first. Never throws. */
const loadCuisines = cache(async () => {
  try {
    return await listPublicCuisines();
  } catch {
    return [];
  }
});

const chip =
  "bg-content2 hover:bg-content3 text-default-600 hover:text-foreground rounded-full px-4 py-1.5 text-sm no-underline transition";

/**
 * Crawlable internal links from the discovery landing to the SSR cuisine and
 * category hub pages (and their spokes).
 *
 * The discovery grid is a client surface whose filter chips do not change the
 * URL, so without these a crawler reaching /discover would only find the hub
 * pages through the sitemap. Real server-rendered <Link>s give those hubs the
 * internal links that make them rank, and give readers a way in. Rendered by the
 * server page so the links are always in the initial HTML.
 */
export async function DiscoverHubLinks() {
  const t = await getTranslations("social.discover");
  const tCat = await getTranslations("social.categories");
  const cuisines = await loadCuisines();

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-6">
      <div className="border-border border-t pt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
          <Link className="text-foreground hover:underline" href="/discover/category">
            {t("browseByCategory")}
          </Link>
        </h2>
        <ul className="mb-8 flex flex-wrap gap-2">
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
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              <Link className="text-foreground hover:underline" href="/discover/cuisine">
                {t("browseByCuisine")}
              </Link>
            </h2>
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
      </div>
    </section>
  );
}
