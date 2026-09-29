import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { listTrendingTopics } from "@norish/db/repositories/follows";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";

export const dynamic = "force-dynamic";

// A generous cap so the hub lists essentially every tag with public recipes.
const TAG_LIMIT = 500;

/** Tags that have public recipes, most-used first. Never throws. */
const loadTags = cache(async () => {
  try {
    return await listTrendingTopics(TAG_LIMIT);
  } catch {
    return [];
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.tagPage");

  return { title: t("indexTitle"), description: t("indexSubtitle") };
}

/** A small crawlable hub that links out to each tag landing page. */
export default async function TagsIndexPage() {
  const t = await getTranslations("social.tagPage");
  const tags = await loadTags();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("indexTitle")}</h1>
        <p className="text-default-500 mt-1">{t("indexSubtitle")}</p>
      </header>

      {tags.length === 0 ? (
        <div className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          <p>{t("empty")}</p>
          <Link className="text-primary mt-2 inline-block hover:underline" href="/discover">
            {t("browseAll")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.name}>
              <Link
                className="bg-content2 hover:bg-content3 text-default-600 hover:text-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm no-underline transition"
                href={`/discover/tag/${cuisineSlug(tag.name)}`}
              >
                <span>#{tag.name}</span>
                <span className="text-default-400 text-xs">{tag.recipeCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
