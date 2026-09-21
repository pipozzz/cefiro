import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

import { PublicCookbookView } from "./cookbook-view";

type Props = { params: Promise<{ slug: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/**
 * Server-load the same payload the client query returns, deduped per request,
 * so the cookbook renders in the initial HTML (fast first paint, and crawlers
 * see the recipes) and metadata reads from the one source. Returns null on any
 * error so the client view falls back to its own fetch / not-found handling.
 */
const loadCookbookView = cache(async (slug: string) => {
  try {
    const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
    const caller = appRouter.createCaller(ctx);

    return await caller.social.getPublicCookbook({ slug });
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cookbook = await loadCookbookView(slug);
  const t = await getTranslations("social.cookbook");

  if (!cookbook) {
    return { title: t("notFoundTitle"), robots: { index: false, follow: false } };
  }

  const origin = await siteOrigin();
  const url = origin ? `${origin}/c/${slug}` : undefined;
  const image = origin ? `${origin}/c/${slug}/og` : undefined;
  const title = cookbook.title;
  const description =
    cookbook.description?.trim() || t("metaDescription", { count: cookbook.recipes.length });

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: "Cefiro",
      url,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicCookbookPage({ params }: Props) {
  const { slug } = await params;
  const initialData = await loadCookbookView(slug);

  return <PublicCookbookView initialData={initialData ?? undefined} slug={slug} />;
}
