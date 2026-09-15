import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { getViewableRecipeRefBySlug } from "@norish/db/repositories/user-profiles";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

import { PublicRecipeView } from "./recipe-view";

type Props = { params: Promise<{ slug: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

/** Rewrite an owner-scoped `/recipes/{id}/{file}` media URL to the public
 * slug-scoped route so crawlers can fetch the og:image without auth. */
function toSlugMediaPath(url: string | null | undefined, slug: string): string | null {
  if (!url) {
    return null;
  }

  if (!url.startsWith("/recipes/")) {
    return url;
  }

  const [pathname] = url.split("?", 1);
  const match = pathname?.match(/^\/recipes\/[^/]+\/([^/]+)$/);

  return match?.[1] ? `/r/${slug}/media/${match[1]}` : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ref = await getViewableRecipeRefBySlug(slug);

  if (!ref) {
    return { title: "Recipe not found", robots: { index: false, follow: false } };
  }

  const full = await getRecipeFull(ref.recipeId);

  if (!full) {
    return { title: "Recipe not found", robots: { index: false, follow: false } };
  }

  const origin = await siteOrigin();
  const url = origin ? `${origin}/r/${slug}` : undefined;
  const imgPath = toSlugMediaPath(primaryRecipeImage(full), slug);
  const image =
    imgPath && origin ? (imgPath.startsWith("http") ? imgPath : `${origin}${imgPath}`) : undefined;

  const title = full.name;
  const description = full.description?.trim() || "A recipe shared on Cefiro.";

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    // Unlisted recipes are reachable by link but must not be indexed.
    robots: ref.visibility === "public" ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
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

export default async function PublicRecipePage({ params }: Props) {
  const { slug } = await params;

  return <PublicRecipeView slug={slug} />;
}
