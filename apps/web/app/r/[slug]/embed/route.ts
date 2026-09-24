import { headers } from "next/headers";

import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

// Read the host from forwarded headers so the card's links work behind the proxy.
export const dynamic = "force-dynamic";

/**
 * Scoped rich-embed endpoint for public recipe links.
 *
 * This is the *only* framable surface of the app: a self-contained, read-only
 * recipe card served as a standalone HTML document (no app chrome, no auth, no
 * mutations). oEmbed `rich` consumers point an `<iframe>` here. Because it is a
 * Route Handler it bypasses the `/r/[slug]` layout entirely, and it sets its own
 * `Content-Security-Policy: frame-ancestors *` so third-party sites may frame it.
 *
 * Site-wide `X-Frame-Options: DENY` is what would otherwise block that framing;
 * `next.config.js` therefore omits that header for this exact path. Every other
 * route stays `DENY`, so relaxing framing here costs no clickjacking surface —
 * there is nothing on this page to click-jack.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await params;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";

  let data: Awaited<ReturnType<typeof loadRecipe>>;

  try {
    data = await loadRecipe(slug);
  } catch {
    data = null;
  }

  if (!data) {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: embedHeaders({ cache: false }),
    });
  }

  const html = cardHtml(data, slug, origin);

  return new Response(html, {
    status: 200,
    headers: embedHeaders({ cache: true }),
  });
}

async function loadRecipe(slug: string) {
  const ctx = await createHttpContextFromHeaders(new Headers(await headers()), null);
  const caller = appRouter.createCaller(ctx);

  return await caller.social.getPublicRecipe({ slug });
}

/**
 * Response headers for the embed. The CSP does double duty: it *allows* framing
 * (`frame-ancestors *`) while locking the document itself down — no scripts, no
 * external anything but images/styles it needs. `X-Frame-Options` is left unset
 * (see the route doc); the global `DENY` is excluded for this path in the Next
 * config so it never reaches here to override the CSP.
 */
function embedHeaders({ cache }: { cache: boolean }): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy":
      "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; frame-ancestors *",
    "Cache-Control": cache ? "public, max-age=3600, s-maxage=3600" : "no-store",
  };
}

/** Minimal HTML escape for interpolating recipe text into the document. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Make a slug-scoped media path absolute; pass absolute URLs through. */
function absUrl(url: string | null | undefined, origin: string): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("http")) {
    return url;
  }

  return origin ? `${origin}${url}` : url;
}

type EmbedData = Awaited<ReturnType<typeof loadRecipe>>;

function cardHtml(data: NonNullable<EmbedData>, slug: string, origin: string): string {
  const { recipe, author } = data;

  const recipeUrl = origin ? `${origin}/r/${slug}` : `/r/${slug}`;
  const image = absUrl(recipe.image, origin);
  const authorName = author ? (author.displayName ?? `@${author.handle}`) : null;

  const metaBits: string[] = [];

  if (recipe.totalMinutes && recipe.totalMinutes > 0) {
    metaBits.push(`${recipe.totalMinutes} min`);
  }

  if (recipe.servings && recipe.servings > 0) {
    metaBits.push(`${recipe.servings} ×`);
  }

  if (recipe.calories && recipe.calories > 0) {
    metaBits.push(`${recipe.calories} kcal`);
  }

  const meta = metaBits.map((b) => `<span class="meta-pill">${esc(b)}</span>`).join("");

  const description = recipe.description?.trim()
    ? `<p class="desc">${esc(recipe.description.trim())}</p>`
    : "";

  const imageBlock = image
    ? `<div class="thumb"><img src="${esc(image)}" alt="${esc(recipe.name)}" loading="lazy" /></div>`
    : `<div class="thumb thumb--empty" style="background:${esc(recipe.dishColor ?? "#336640")}"></div>`;

  const authorBlock = authorName ? `<span class="author">${esc(authorName)}</span>` : "";

  // A single link wrapping the whole card. `target="_blank"` opens the full
  // recipe on Naša Kuchyňa in a new tab; `rel="noopener noreferrer"` severs the
  // opener so the framed document can never reach the parent page.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(recipe.name)} — Naša Kuchyňa</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: transparent;
  }
  .card {
    display: flex;
    text-decoration: none;
    color: inherit;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 16px;
    overflow: hidden;
    background: #ffffff;
    max-width: 640px;
    margin: 0 auto;
  }
  @media (prefers-color-scheme: dark) {
    .card { background: #1c1c1e; border-color: rgba(255,255,255,0.12); }
    .desc { color: #a1a1aa !important; }
    .meta-pill { background: rgba(255,255,255,0.08) !important; color: #d4d4d8 !important; }
    .brand { color: #9ca3af !important; }
  }
  .thumb { flex: 0 0 40%; min-height: 150px; max-width: 220px; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb--empty { min-height: 150px; }
  .body { flex: 1 1 auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .title { font-size: 18px; font-weight: 700; line-height: 1.25; margin: 0; }
  .author { font-size: 13px; color: #336640; font-weight: 600; }
  .desc {
    font-size: 14px; line-height: 1.45; color: #52525b; margin: 0;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .meta-pill { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(51,102,64,0.12); color: #336640; }
  .footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 4px; }
  .cta { font-size: 13px; font-weight: 700; color: #336640; }
  .brand { font-size: 12px; color: #71717a; }
  @media (max-width: 420px) {
    .card { flex-direction: column; }
    .thumb { flex-basis: auto; max-width: none; width: 100%; }
  }
</style>
</head>
<body>
  <a class="card" href="${esc(recipeUrl)}" target="_blank" rel="noopener noreferrer">
    ${imageBlock}
    <div class="body">
      ${authorBlock}
      <h1 class="title">${esc(recipe.name)}</h1>
      ${description}
      <div class="meta">${meta}</div>
      <div class="footer">
        <span class="cta">View recipe →</span>
        <span class="brand">Naša Kuchyňa</span>
      </div>
    </div>
  </a>
</body>
</html>`;
}

function notFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Recipe not found — Naša Kuchyňa</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center; min-height: 120px; background: transparent; }
  p { color: #71717a; font-size: 14px; }
</style>
</head>
<body><p>Recipe not found.</p></body>
</html>`;
}
