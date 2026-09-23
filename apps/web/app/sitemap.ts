import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { ALL_CATEGORY_SLUGS } from "@/lib/recipe-categories";

import { listPublicCookbookSlugs } from "@norish/db/repositories/public-cookbooks";
import {
  listPublicProfileHandles,
  listPublicRecipeSlugs,
} from "@norish/db/repositories/user-profiles";

// Built per-request from the (forwarded) host so it works behind the proxy.
export const dynamic = "force-dynamic";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");

  return host ? `${proto}://${host}` : "";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteOrigin();

  if (!base) {
    return [];
  }

  const [recipes, profiles, cookbooks] = await Promise.all([
    listPublicRecipeSlugs(),
    listPublicProfileHandles(),
    listPublicCookbookSlugs(),
  ]);

  return [
    { url: `${base}/discover`, changeFrequency: "daily", priority: 0.8 },
    // Category hubs: a small set of evergreen landing pages for long-tail search.
    { url: `${base}/discover/category`, changeFrequency: "weekly", priority: 0.6 },
    ...ALL_CATEGORY_SLUGS.map((slug) => ({
      url: `${base}/discover/category/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...recipes.map((r) => ({
      url: `${base}/r/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...profiles.map((p) => ({
      url: `${base}/u/${p.handle}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...cookbooks.map((c) => ({
      url: `${base}/c/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
