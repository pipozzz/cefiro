import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { categoryFromSlug } from "@/lib/recipe-categories";
import { getTranslations } from "next-intl/server";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

// Fresh server render (host is read from forwarded headers, and public content
// changes), so crawlers and readers always get the current recipes as real HTML.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/**
 * The public recipes in one category, server-loaded through the same `discover`
 * procedure the client uses (so cards, ratings and images match), deduped per
 * request. Never throws — an empty list just renders the empty state.
 */
const loadCategoryRecipes = cache(async (category: "Breakfast" | "Lunch" | "Dinner" | "Snack") => {
  try {
    const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
    const caller = appRouter.createCaller(ctx);
    const { recipes } = await caller.social.discover({ category, limit: 24 });

    return recipes;
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);

  if (!category) {
    return {};
  }

  const [tCat, t] = await Promise.all([
    getTranslations("social.categories"),
    getTranslations("social.categoryPage"),
  ]);
  const label = tCat(category);
  const title = t("heading", { category: label });
  const description = t("subtitle", { category: label });
  const origin = await siteOrigin();
  const url = origin ? `${origin}/discover/category/${slug}` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategoryLandingPage({ params }: Props) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);

  if (!category) {
    notFound();
  }

  const [tCat, t] = await Promise.all([
    getTranslations("social.categories"),
    getTranslations("social.categoryPage"),
  ]);
  const label = tCat(category);
  const recipes = await loadCategoryRecipes(category);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("heading", { category: label })}</h1>
        <p className="text-default-500 mt-1">{t("subtitle", { category: label })}</p>
      </header>

      {recipes.length === 0 ? (
        <div className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          <p>{t("empty")}</p>
          <Link className="text-primary mt-2 inline-block hover:underline" href="/discover">
            {t("browseAll")}
          </Link>
        </div>
      ) : (
        <SocialRecipeGrid recipes={recipes} />
      )}
    </div>
  );
}
