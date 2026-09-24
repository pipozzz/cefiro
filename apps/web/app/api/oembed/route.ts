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
 * Given `?url=<...>/r/<slug>` it returns a `rich`-type oEmbed document — an
 * `<iframe>` pointing at the scoped, framable `/r/<slug>/embed` card — plus the
 * title, author, provider and thumbnail, so consumers that speak oEmbed (Ghost,
 * WordPress, …) can render an interactive card from a recipe link. Discovery
 * `<link>` tags on the recipe page point here. Only public/unlisted recipes
 * resolve; anything else is a 404. Consumers that prefer a plain card can ignore
 * the `html` and use the metadata alone.
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

  // The rich card's iframe. Sized for a compact recipe card; the embed document
  // is responsive and stacks below ~420px. `title` gives assistive tech a label.
  const embedUrl = `${origin}/r/${slug}/embed`;
  const width = 640;
  const height = 180;
  const html =
    `<iframe src="${embedUrl}" width="${width}" height="${height}" ` +
    `title="${recipe.recipe.name.replace(/"/g, "&quot;")}" frameborder="0" ` +
    `scrolling="no" style="border:0;max-width:100%;" loading="lazy"></iframe>`;

  const body = {
    version: "1.0",
    type: "rich",
    html,
    width,
    height,
    title: recipe.recipe.name,
    author_name: authorName,
    author_url: authorUrl,
    provider_name: "Naša Kuchyňa",
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
