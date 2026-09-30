/**
 * Root URL segments that already belong to real routes (static pages, route
 * groups, metadata files, media proxies). A custom page's slug must never shadow
 * one of these, or it could hide login/settings/etc. Shared by the admin
 * create-validation and the auth proxy's page-bypass so they can never disagree.
 *
 * Keep in sync with apps/web/app routes. `about`/`terms`/`privacy` are NOT
 * reserved: they moved into the CMS (seeded as pages at those slugs), so they
 * are ordinary custom pages an admin can edit or rename.
 */
export const RESERVED_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  // Static + dynamic root routes
  "api",
  "c",
  "discover",
  "images",
  "instance-invite",
  "invite",
  "pa",
  "p",
  "public-avatars",
  "r",
  "serwist",
  "share",
  "themes",
  "u",
  "~offline",
  // Metadata files
  "sitemap.xml",
  "robots.txt",
  "manifest.webmanifest",
  "sw.js",
  "favicon.ico",
  // (app) route group (no URL segment)
  "calendar",
  "cookbooks",
  "feed",
  "groceries",
  "household",
  "library",
  "notifications",
  "profile",
  "recipes",
  "settings",
  "welcome",
  // (auth) route group
  "auth-error",
  "login",
  "signup",
]);

/** A page slug: lowercase, digits and single hyphens, 1–80 chars. */
export const PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isReservedRootSlug(slug: string): boolean {
  return RESERVED_ROOT_SEGMENTS.has(slug.toLowerCase());
}

/** True when `slug` is a valid, non-reserved page slug. */
export function isUsablePageSlug(slug: string): boolean {
  return (
    slug.length >= 1 && slug.length <= 80 && PAGE_SLUG_RE.test(slug) && !isReservedRootSlug(slug)
  );
}
