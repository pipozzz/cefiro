import type { Metadata } from "next";
import Link from "next/link";
import { ALL_CATEGORIES, categorySlug } from "@/lib/recipe-categories";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.categoryPage");

  return { title: t("indexTitle"), description: t("indexSubtitle") };
}

/** A small crawlable hub that links out to each category landing page. */
export default async function CategoriesIndexPage() {
  const [tCat, t] = await Promise.all([
    getTranslations("social.categories"),
    getTranslations("social.categoryPage"),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("indexTitle")}</h1>
        <p className="text-default-500 mt-1">{t("indexSubtitle")}</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ALL_CATEGORIES.map((category) => (
          <li key={category}>
            <Link
              className="bg-content2 hover:bg-content3 text-foreground flex items-center justify-center rounded-2xl px-4 py-6 text-center font-semibold no-underline transition"
              href={`/discover/category/${categorySlug(category)}`}
            >
              {tCat(category)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
