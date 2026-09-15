import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import {
  getProfileByUserId,
  getViewableRecipeRefBySlug,
} from "@norish/db/repositories/user-profiles";
import type { FullRecipeDTO } from "@norish/shared/contracts";
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
 * slug-scoped route so crawlers can fetch images without auth. */
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

/** Deduped per-request loader shared by generateMetadata and the page render. */
const loadRecipe = cache(async (slug: string) => {
  const ref = await getViewableRecipeRefBySlug(slug);

  if (!ref) {
    return null;
  }

  const full = await getRecipeFull(ref.recipeId);

  if (!full) {
    return null;
  }

  const authorProfile = ref.userId ? await getProfileByUserId(ref.userId) : null;
  const author = authorProfile?.isPublic ? authorProfile : null;

  return { ref, full, author };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadRecipe(slug);

  if (!data) {
    return { title: "Recipe not found", robots: { index: false, follow: false } };
  }

  const { ref, full } = data;
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

function toIsoDuration(minutes: number | null | undefined): string | undefined {
  return minutes && minutes > 0 ? `PT${minutes}M` : undefined;
}

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }

  return Number.parseFloat(amount.toFixed(2)).toString();
}

/** schema.org/Recipe structured data — powers Google recipe rich results. */
function buildRecipeJsonLd(
  full: FullRecipeDTO,
  slug: string,
  origin: string,
  author: { handle: string; displayName: string | null } | null
): Record<string, unknown> {
  const abs = (path: string | null): string | undefined =>
    path ? (path.startsWith("http") ? path : origin ? `${origin}${path}` : undefined) : undefined;

  const imagePaths = [
    toSlugMediaPath(primaryRecipeImage(full), slug),
    ...(full.images ?? []).map((img) => toSlugMediaPath(img.image, slug)),
  ];
  const images = Array.from(
    new Set(imagePaths.map((p) => abs(p)).filter((u): u is string => !!u))
  );

  const ingredients = (full.recipeIngredients ?? [])
    .map((i) => `${formatAmount(i.amount)} ${i.unit ?? ""} ${i.ingredientName}`.trim())
    .filter(Boolean);

  const instructions = (full.steps ?? [])
    .filter((s) => s.step?.trim())
    .map((s) => ({ "@type": "HowToStep", text: s.step }));

  const hasNutrition = full.calories || full.protein || full.carbs || full.fat;

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: full.name,
    description: full.description?.trim() || undefined,
    image: images.length > 0 ? images : undefined,
    author:
      author && origin
        ? {
            "@type": "Person",
            name: author.displayName ?? `@${author.handle}`,
            url: `${origin}/u/${author.handle}`,
          }
        : undefined,
    datePublished: full.createdAt ? new Date(full.createdAt).toISOString() : undefined,
    prepTime: toIsoDuration(full.prepMinutes),
    cookTime: toIsoDuration(full.cookMinutes),
    totalTime: toIsoDuration(full.totalMinutes),
    recipeYield: full.servings ? String(full.servings) : undefined,
    recipeCategory: full.categories?.length ? full.categories.join(", ") : undefined,
    keywords: full.tags?.length ? full.tags.map((t) => t.name).join(", ") : undefined,
    recipeIngredient: ingredients.length > 0 ? ingredients : undefined,
    recipeInstructions: instructions.length > 0 ? instructions : undefined,
    nutrition: hasNutrition
      ? {
          "@type": "NutritionInformation",
          calories: full.calories ? `${full.calories} calories` : undefined,
          proteinContent: full.protein ? `${full.protein} g` : undefined,
          carbohydrateContent: full.carbs ? `${full.carbs} g` : undefined,
          fatContent: full.fat ? `${full.fat} g` : undefined,
        }
      : undefined,
  };
}

export default async function PublicRecipePage({ params }: Props) {
  const { slug } = await params;
  const data = await loadRecipe(slug);

  // Structured data only for indexable (public) recipes.
  let jsonLd: string | null = null;

  if (data && data.ref.visibility === "public") {
    const origin = await siteOrigin();
    const ld = buildRecipeJsonLd(
      data.full,
      slug,
      origin,
      data.author ? { handle: data.author.handle, displayName: data.author.displayName } : null
    );
    // Escape `<` so user content (e.g. a recipe name containing "</script>")
    // can never break out of the JSON-LD script tag.
    jsonLd = JSON.stringify(ld).replace(/</g, "\\u003c");
  }

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      ) : null}
      <PublicRecipeView slug={slug} />
    </>
  );
}
