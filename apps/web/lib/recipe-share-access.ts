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
    // Instance invites let an admin-invited person register while public
    // signup is locked; the invitee is signed-out, so this must be reachable
    // without the auth proxy bouncing them to a (locked) login.
    pathname.startsWith("/instance-invite/") ||
    // Legal pages must be readable signed-out — a visitor reads them before
    // (and in order to) register.
    pathname === "/terms" ||
    pathname === "/privacy" ||
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
