import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

// Host is read from forwarded headers so links work behind the proxy.
export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;

  return `${proto}://${host}`;
}

/** Pull the recipe slug out of a `/r/<slug>` URL, or null when it isn't one. */
function recipeSlugFromUrl(raw: string): string | null {
  try {
    const match = new URL(raw).pathname.match(/^\/r\/([^/]+)\/?$/);

    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * oEmbed provider endpoint (https://oembed.com) for public recipe links.
 *
 * Given `?url=<...>/r/<slug>` it returns a `link`-type oEmbed document — title,
 * author, provider and a thumbnail — so consumers that speak oEmbed (Ghost,
 * WordPress, …) can render a rich card from a recipe link. Discovery `<link>`
 * tags on the recipe page point here. Only public/unlisted recipes resolve;
 * anything else is a 404. A `rich` (iframe) card would need the site-wide
 * X-Frame-Options to be relaxed for an embed route, so it is intentionally left
 * for later.
 */
export async function GET(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);
  const target = requestUrl.searchParams.get("url");
  const format = requestUrl.searchParams.get("format") ?? "json";

  // The spec allows xml, but we only implement json.
  if (format !== "json") {
    return NextResponse.json({ error: "Only json format is supported" }, { status: 501 });
  }

  if (!target) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const slug = recipeSlugFromUrl(target);

  if (!slug) {
    return NextResponse.json({ error: "Not a recipe url" }, { status: 404 });
  }

  const origin = baseUrl(req);

  let recipe: Awaited<ReturnType<typeof loadRecipe>>;

  try {
    recipe = await loadRecipe(slug);
  } catch {
    recipe = null;
  }

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const author = recipe.author;
  const authorName = author ? (author.displayName ?? `@${author.handle}`) : undefined;
  const authorUrl = author ? `${origin}/u/${author.handle}` : undefined;

  // Prefer the recipe's own photo; fall back to the branded, always-present
  // 1200×630 share card so every recipe has a thumbnail.
  const photo = recipe.recipe.image
    ? recipe.recipe.image.startsWith("http")
      ? recipe.recipe.image
      : `${origin}${recipe.recipe.image}`
    : null;

  const body = {
    version: "1.0",
    type: "link",
    title: recipe.recipe.name,
    author_name: authorName,
    author_url: authorUrl,
    provider_name: "Cefiro",
    provider_url: origin,
    thumbnail_url: photo ?? `${origin}/r/${slug}/og`,
    // Only the branded fallback card has known dimensions.
    ...(photo ? {} : { thumbnail_width: 1200, thumbnail_height: 630 }),
    cache_age: 3600,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}

async function loadRecipe(slug: string) {
  const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
  const caller = appRouter.createCaller(ctx);

  return await caller.social.getPublicRecipe({ slug });
}
