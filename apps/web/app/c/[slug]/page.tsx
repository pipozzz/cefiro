import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getPublicCookbookBySlug } from "@norish/db/repositories/public-cookbooks";

import { PublicCookbookView } from "./cookbook-view";

type Props = { params: Promise<{ slug: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/** Deduped per-request loader shared by generateMetadata and the page render. */
const loadCookbook = cache(async (slug: string) => getPublicCookbookBySlug(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cookbook = await loadCookbook(slug);
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

  return <PublicCookbookView slug={slug} />;
}
