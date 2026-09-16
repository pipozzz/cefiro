import { ImageResponse } from "next/og";

import { getPublicCookbookBySlug } from "@norish/db/repositories/public-cookbooks";

// Needs the database, so it must run on Node (not edge).
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

const BRAND_GREEN = "#336640";
const BRAND_CREAM = "#FFFEF7";

function clamp(text: string, max: number): string {
  const t = text.trim();

  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

type Props = { params: Promise<{ slug: string }> };

/**
 * Branded 1200×630 share card for a public cookbook: title, description, its
 * recipe count and owner, and the Cefiro wordmark. Mirrors the recipe card.
 */
export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const cookbook = await getPublicCookbookBySlug(slug);

  if (!cookbook) {
    return new ImageResponse(<BrandFallback />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  }

  const ownerName = cookbook.owner
    ? (cookbook.owner.displayName ?? `@${cookbook.owner.handle}`)
    : null;
  const count = cookbook.recipes.length;
  const recipesLabel = count === 1 ? "1 recipe" : `${count} recipes`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        backgroundColor: BRAND_GREEN,
        backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(0,0,0,0.4))",
        color: BRAND_CREAM,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          Cefiro
        </div>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>📚 Cookbook</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            textShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          {clamp(cookbook.title, 80)}
        </div>

        {cookbook.description ? (
          <div
            style={{ display: "flex", marginTop: 20, fontSize: 32, opacity: 0.9, lineHeight: 1.3 }}
          >
            {clamp(cookbook.description, 120)}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 28,
            fontSize: 32,
            opacity: 0.95,
          }}
        >
          <span style={{ display: "flex" }}>{recipesLabel}</span>
          {ownerName ? (
            <>
              <span style={{ display: "flex", margin: "0 16px", opacity: 0.6 }}>•</span>
              <span style={{ display: "flex" }}>{clamp(ownerName, 40)}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    { width: WIDTH, height: HEIGHT, headers: CACHE_HEADERS }
  );
}

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
      Cefiro
    </div>
  );
}
