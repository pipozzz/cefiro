import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { getTranslations } from "next-intl/server";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

// Fresh server render (host from forwarded headers; public content changes), so
// crawlers and readers always get the current recipes as real HTML.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/**
 * One theme resolved by its name slug (the stable URL key) through the same
 * vector search the in-app tiles use, so cards/ratings/images match. Deduped per
 * request. Returns `{ name: null }` when no current theme matches the slug — the
 * page then 404s (a theme can vanish when the set is rebuilt).
 */
const loadTheme = cache(async (slug: string) => {
  try {
    const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
    const caller = appRouter.createCaller(ctx);

    return await caller.social.themeRecipesBySlug({ slug, limit: 24 });
  } catch {
    return { name: null as string | null, recipes: [] };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { name } = await loadTheme(slug);

  if (!name) {
    return {};
  }

  const t = await getTranslations("social.themesPage");
  const title = t("heading", { theme: name });
  const description = t("subtitle", { theme: name });
  const origin = await siteOrigin();
  const url = origin ? `${origin}/discover/themes/${slug}` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ThemeLandingPage({ params }: Props) {
  const { slug } = await params;
  const { name, recipes } = await loadTheme(slug);

  if (!name) {
    notFound();
  }

  const t = await getTranslations("social.themesPage");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <Link className="text-primary text-sm hover:underline" href="/discover/themes">
          ← {t("allThemes")}
        </Link>
        <h1 className="text-foreground mt-2 text-3xl font-bold">{t("heading", { theme: name })}</h1>
        <p className="text-default-500 mt-1">{t("subtitle", { theme: name })}</p>
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
