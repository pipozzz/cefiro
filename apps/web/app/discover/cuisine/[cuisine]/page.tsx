import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { getTranslations } from "next-intl/server";

import { listPublicCuisines } from "@norish/db/repositories/cuisines";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";
import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

// Fresh server render (host is read from forwarded headers, and public content
// changes), so crawlers and readers always get the current recipes as real HTML.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cuisine: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/**
 * Resolve a URL slug back to a real cuisine name. Cuisines are free-text
 * vocabulary, so the slug set is data-driven: match the slug against the slugs
 * of the cuisines that actually have public recipes. Deduped per request.
 */
const resolveCuisine = cache(async (slug: string): Promise<string | null> => {
  try {
    const cuisines = await listPublicCuisines();
    const match = cuisines.find((c) => cuisineSlug(c.name) === slug.toLowerCase());

    return match?.name ?? null;
  } catch {
    return null;
  }
});

/**
 * The public recipes for one cuisine, server-loaded through the same `discover`
 * procedure the client uses (so cards, ratings and images match), deduped per
 * request. Never throws — an empty list just renders the empty state.
 */
const loadCuisineRecipes = cache(async (cuisine: string) => {
  try {
    const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
    const caller = appRouter.createCaller(ctx);
    const { recipes } = await caller.social.discover({ cuisine, limit: 24 });

    return recipes;
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cuisine: slug } = await params;
  const cuisine = await resolveCuisine(slug);

  if (!cuisine) {
    return {};
  }

  const t = await getTranslations("social.cuisinePage");
  const title = t("heading", { cuisine });
  const description = t("subtitle", { cuisine });
  const origin = await siteOrigin();
  const url = origin ? `${origin}/discover/cuisine/${slug}` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CuisineLandingPage({ params }: Props) {
  const { cuisine: slug } = await params;
  const cuisine = await resolveCuisine(slug);

  if (!cuisine) {
    notFound();
  }

  const t = await getTranslations("social.cuisinePage");
  const recipes = await loadCuisineRecipes(cuisine);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("heading", { cuisine })}</h1>
        <p className="text-default-500 mt-1">{t("subtitle", { cuisine })}</p>
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
