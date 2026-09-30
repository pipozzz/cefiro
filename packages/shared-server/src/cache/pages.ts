import { listPublishedPageSlugs } from "@norish/db/repositories/pages";
import { getPublisherClient } from "@norish/shared-server/redis/client";

const CACHE_KEY = "norish:cache:pages:published-slugs";
const CACHE_TTL_SECONDS = 60;

/**
 * The set of published page slugs, cached in Redis with a short TTL. The auth
 * proxy consults this on every root single-segment request to decide whether an
 * anonymous visitor may see a page — one Redis GET, no DB hit — so it must stay
 * cheap. Invalidated on any page create/update/delete.
 */
export async function getCachedPublishedPageSlugs(): Promise<Set<string>> {
  const redis = await getPublisherClient();

  const cached = await redis.get(CACHE_KEY);

  if (cached) {
    try {
      return new Set(JSON.parse(cached) as string[]);
    } catch {
      // fall through to a fresh read
    }
  }

  const rows = await listPublishedPageSlugs();
  const slugs = rows.map((row) => row.slug);

  await redis.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(slugs));

  return new Set(slugs);
}

/** Drop the cached slug set (call after any page write). */
export async function invalidatePublishedPageSlugs(): Promise<void> {
  const redis = await getPublisherClient();

  await redis.del(CACHE_KEY);
}
