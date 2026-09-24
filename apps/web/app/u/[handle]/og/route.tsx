import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { getProfileByHandle } from "@norish/db/repositories/user-profiles";

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

type Props = { params: Promise<{ handle: string }> };

/**
 * Branded 1200×630 share card for a public profile: an initial avatar, the
 * display name, @handle and bio, plus the Naša Kuchyňa wordmark. Mirrors the recipe
 * and cookbook cards.
 */
export async function GET(_req: Request, { params }: Props) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  const t = await getTranslations("social.profile");

  if (!profile || !profile.isPublic) {
    return new ImageResponse(<BrandFallback />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  }

  const displayName = profile.displayName ?? `@${profile.handle}`;

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

      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 140,
            height: 140,
            borderRadius: 999,
            backgroundColor: BRAND_CREAM,
            color: BRAND_GREEN,
            fontSize: 72,
            fontWeight: 800,
            marginRight: 36,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {clamp(displayName, 40)}
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 34, opacity: 0.85 }}>
            @{profile.handle}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 32, opacity: 0.9, lineHeight: 1.3 }}>
        {profile.bio?.trim() ? clamp(profile.bio, 140) : t("ogTagline")}
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
      Naša Kuchyňa
    </div>
  );
}
