import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { listPublicCuisines } from "@norish/db/repositories/cuisines";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";

export const dynamic = "force-dynamic";

/** Cuisines that have public recipes, most-used first. Never throws. */
const loadCuisines = cache(async () => {
  try {
    return await listPublicCuisines();
  } catch {
    return [];
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.cuisinePage");

  return { title: t("indexTitle"), description: t("indexSubtitle") };
}

/** A small crawlable hub that links out to each cuisine landing page. */
export default async function CuisinesIndexPage() {
  const t = await getTranslations("social.cuisinePage");
  const cuisines = await loadCuisines();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("indexTitle")}</h1>
        <p className="text-default-500 mt-1">{t("indexSubtitle")}</p>
      </header>

      {cuisines.length === 0 ? (
        <div className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          <p>{t("empty")}</p>
          <Link className="text-primary mt-2 inline-block hover:underline" href="/discover">
            {t("browseAll")}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cuisines.map((cuisine) => (
            <li key={cuisine.name}>
              <Link
                className="bg-content2 hover:bg-content3 text-foreground flex flex-col items-center justify-center gap-1 rounded-2xl px-4 py-6 text-center font-semibold no-underline transition"
                href={`/discover/cuisine/${cuisineSlug(cuisine.name)}`}
              >
                <span>{cuisine.name}</span>
                <span className="text-default-400 text-xs font-normal">
                  {t("recipeCount", { count: cuisine.recipeCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
