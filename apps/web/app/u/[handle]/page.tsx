import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getProfileByHandle } from "@norish/db/repositories/user-profiles";

import { PublicProfileView } from "./profile-view";

type Props = { params: Promise<{ handle: string }> };

/** Deduped per-request loader shared by generateMetadata and the page render. */
const loadProfile = cache(async (handle: string) => getProfileByHandle(handle));

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  const t = await getTranslations("social.profile");

  if (!profile || !profile.isPublic) {
    return { title: t("notFoundTitle"), robots: { index: false, follow: false } };
  }

  const origin = await siteOrigin();
  const url = origin ? `${origin}/u/${profile.handle}` : undefined;
  const displayName = profile.displayName ?? `@${profile.handle}`;
  const title = `${displayName} (@${profile.handle})`;
  const description = profile.bio?.trim() || t("metaDescription", { handle: profile.handle });
  // A branded card instead of the (small, square) avatar, so a shared profile
  // link gets a rich large preview like recipes and cookbooks do.
  const image = origin ? `${origin}/u/${profile.handle}/og` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: "profile",
      title,
      description,
      siteName: "Naša Kuchyňa",
      url,
      images: image ? [{ url: image, alt: displayName }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/** schema.org/ProfilePage + Person structured data, so a public cook's page is
 * eligible for richer search results — parallel to the Recipe JSON-LD on
 * /r/[slug]. Only emitted for public profiles. */
function buildProfileJsonLd(
  profile: {
    handle: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    websiteUrl: string | null;
    createdAt: Date | string | null;
  },
  origin: string
): Record<string, unknown> {
  const url = `${origin}/u/${profile.handle}`;
  const image = profile.avatarUrl
    ? profile.avatarUrl.startsWith("http")
      ? profile.avatarUrl
      : `${origin}${profile.avatarUrl}`
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: profile.createdAt ? new Date(profile.createdAt).toISOString() : undefined,
    mainEntity: {
      "@type": "Person",
      name: profile.displayName ?? `@${profile.handle}`,
      alternateName: `@${profile.handle}`,
      identifier: profile.handle,
      description: profile.bio?.trim() || undefined,
      image,
      url,
      sameAs: profile.websiteUrl?.trim() ? [profile.websiteUrl.trim()] : undefined,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const profile = await loadProfile(handle);

  let jsonLd: string | null = null;

  if (profile?.isPublic) {
    const origin = await siteOrigin();

    if (origin) {
      const ld = buildProfileJsonLd(profile, origin);
      // Escape `<` so profile content (e.g. a bio containing "</script>") can
      // never break out of the JSON-LD script tag.
      jsonLd = JSON.stringify(ld).replace(/</g, "\\u003c");
    }
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
      <PublicProfileView handle={handle} />
    </>
  );
}
