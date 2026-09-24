import { ImageResponse } from "next/og";

import { getAverageRating } from "@norish/db/repositories/ratings";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import {
  getProfileByUserId,
  getViewableRecipeRefBySlug,
} from "@norish/db/repositories/user-profiles";

// Needs the database, so it must run on Node (not edge).
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

// Crawlers refetch these rarely; let the CDN and clients cache them and serve
// a stale card while a fresh one regenerates in the background.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

const BRAND_GREEN = "#336640";
const BRAND_CREAM = "#FFFEF7";

/** Clamp a title to a sensible length so it never overflows the card. */
function clampTitle(name: string): string {
  const trimmed = name.trim();

  return trimmed.length > 90 ? `${trimmed.slice(0, 89)}…` : trimmed;
}

type Props = { params: Promise<{ slug: string }> };

/**
 * Branded 1200×630 share card for a public recipe: the dish colour as a
 * gradient ground, the recipe title, its author and rating, and the Naša Kuchyňa
 * wordmark. Used as the Open Graph image for recipes without a photo (recipes
 * that have one keep the photo itself — see generateMetadata in ../page.tsx).
 */
export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const ref = await getViewableRecipeRefBySlug(slug);
  const full = ref ? await getRecipeFull(ref.recipeId) : null;

  if (!ref || !full) {
    return new ImageResponse(<BrandFallback />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  }

  const authorProfile = ref.userId ? await getProfileByUserId(ref.userId) : null;
  const author = authorProfile?.isPublic ? authorProfile : null;
  const rating = await getAverageRating(ref.recipeId);

  const dishColor = full.dishColor?.trim() || BRAND_GREEN;
  const authorName = author ? (author.displayName ?? `@${author.handle}`) : null;
  const hasRating = rating.averageRating && rating.ratingCount > 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        // Dish colour ground, deepened toward the bottom so light text reads.
        backgroundColor: dishColor,
        backgroundImage: `linear-gradient(160deg, rgba(0,0,0,0.05), rgba(0,0,0,0.65))`,
        color: BRAND_CREAM,
        fontFamily: "sans-serif",
      }}
    >
      {/* Brand chip */}
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: BRAND_CREAM,
            color: BRAND_GREEN,
            fontSize: 34,
            fontWeight: 700,
            padding: "8px 24px",
            borderRadius: 999,
            letterSpacing: -0.5,
          }}
        >
          Naša Kuchyňa
        </div>
      </div>

      {/* Title + meta */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          {clampTitle(full.name)}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 28,
            fontSize: 34,
            opacity: 0.95,
          }}
        >
          {authorName ? <span style={{ display: "flex" }}>{authorName}</span> : null}
          {authorName && hasRating ? (
            <span style={{ display: "flex", margin: "0 16px", opacity: 0.6 }}>•</span>
          ) : null}
          {hasRating ? (
            <span style={{ display: "flex", alignItems: "center" }}>
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="#FFCE45"
                style={{ marginRight: 10 }}
              >
                <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.401 8.169L12 18.896l-7.335 3.869 1.401-8.169L.132 9.21l8.2-1.192z" />
              </svg>
              {rating.averageRating?.toFixed(1)}
              <span style={{ display: "flex", marginLeft: 8, opacity: 0.7 }}>
                ({rating.ratingCount})
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </div>,
    { width: WIDTH, height: HEIGHT, headers: CACHE_HEADERS }
  );
}

/** Generic card for a missing/removed recipe. */
function BrandFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND_GREEN,
        color: BRAND_CREAM,
        fontSize: 96,
        fontWeight: 800,
        letterSpacing: -2,
        fontFamily: "sans-serif",
      }}
    >
      Naša Kuchyňa
    </div>
  );
}
