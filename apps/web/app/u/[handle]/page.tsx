import type { Metadata } from "next";
import { headers } from "next/headers";

import { getProfileByHandle } from "@norish/db/repositories/user-profiles";

import { PublicProfileView } from "./profile-view";

type Props = { params: Promise<{ handle: string }> };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile || !profile.isPublic) {
    return { title: "Profile not found", robots: { index: false, follow: false } };
  }

  const origin = await siteOrigin();
  const url = origin ? `${origin}/u/${profile.handle}` : undefined;
  const displayName = profile.displayName ?? `@${profile.handle}`;
  const title = `${displayName} (@${profile.handle})`;
  const description = profile.bio?.trim() || `Recipes by @${profile.handle} on Cefiro.`;
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
      siteName: "Cefiro",
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

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;

  return <PublicProfileView handle={handle} />;
}
