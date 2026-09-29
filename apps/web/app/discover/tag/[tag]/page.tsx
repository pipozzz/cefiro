import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { getTranslations } from "next-intl/server";

import { listTrendingTopics } from "@norish/db/repositories/follows";
import { cuisineSlug } from "@norish/shared/lib/cuisine-slug";
import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

// Fresh server render (host from forwarded headers; public content changes), so
// crawlers and readers always get the current recipes as real HTML.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tag: string }> };

// A generous cap: enough to resolve any real tag slug and to list them all.
const TAG_LIMIT = 500;

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/**
 * Resolve a URL slug back to a real tag name. Tags are free-text, so the slug
 * set is data-driven: match the slug against the slugs of the tags that actually
 * have public recipes (`cuisineSlug` is a generic slugifier). Deduped per request.
 */
const resolveTag = cache(async (slug: string): Promise<string | null> => {
  try {
    const tags = await listTrendingTopics(TAG_LIMIT);
    const match = tags.find((topic) => cuisineSlug(topic.name) === slug.toLowerCase());

    return match?.name ?? null;
  } catch {
    return null;
  }
});

/**
 * Public recipes carrying one tag, server-loaded through the same `discover`
 * procedure the client uses (so cards, ratings and images match), deduped per
 * request. Never throws — an empty list just renders the empty state.
 */
const loadTagRecipes = cache(async (tag: string) => {
  try {
    const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
    const caller = appRouter.createCaller(ctx);
    const { recipes } = await caller.social.discover({ tag, limit: 24 });

    return recipes;
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag: slug } = await params;
  const tag = await resolveTag(slug);

  if (!tag) {
    return {};
  }

  const t = await getTranslations("social.tagPage");
  const title = t("heading", { tag });
  const description = t("subtitle", { tag });
  const origin = await siteOrigin();
  const url = origin ? `${origin}/discover/tag/${slug}` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function TagLandingPage({ params }: Props) {
  const { tag: slug } = await params;
  const tag = await resolveTag(slug);

  if (!tag) {
    notFound();
  }

  const t = await getTranslations("social.tagPage");
  const recipes = await loadTagRecipes(tag);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-6">
      <header className="mt-4 mb-6">
        <h1 className="text-foreground text-3xl font-bold">{t("heading", { tag })}</h1>
        <p className="text-default-500 mt-1">{t("subtitle", { tag })}</p>
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
