import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
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

  if (!cookbook) {
    return { title: "Cookbook not found", robots: { index: false, follow: false } };
  }

  const origin = await siteOrigin();
  const url = origin ? `${origin}/c/${slug}` : undefined;
  const image = origin ? `${origin}/c/${slug}/og` : undefined;
  const title = cookbook.title;
  const description =
    cookbook.description?.trim() ||
    `A cookbook of ${cookbook.recipes.length} recipes shared on Cefiro.`;

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
