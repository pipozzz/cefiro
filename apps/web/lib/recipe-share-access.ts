import type { NextRequest } from "next/server";

import { getActiveRecipeShareByToken } from "@norish/db/repositories/recipe-shares";

export function isRecipeSharePagePath(pathname: string): boolean {
  return pathname.startsWith("/share/");
}

/**
 * cefiro social layer: public, signed-out pages served without auth —
 * public recipes (`/r/…`), public profiles (`/u/…`) and the pretty
 * `/@handle` alias (rewritten to `/u/handle`).
 */
export function isPublicSocialPath(pathname: string): boolean {
  return (
    pathname.startsWith("/r/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/u/") ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/public-avatars/") ||
    pathname === "/discover" ||
    pathname.startsWith("/discover/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  );
}

export function shouldBypassAuthProxy(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;

  return isRecipeSharePagePath(pathname) || isPublicSocialPath(pathname);
}

export async function getSharedRecipeByToken(token: string) {
  return getActiveRecipeShareByToken(token, { touchLastAccessedAt: true });
}

export function getSharedRecipeMediaCacheControl(): string {
  return "no-store";
}
