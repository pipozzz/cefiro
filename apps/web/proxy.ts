import { NextRequest, NextResponse } from "next/server";
import { shouldBypassAuthProxy } from "@/lib/recipe-share-access";

import { getVerifiedSession } from "@norish/auth/session";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

export async function proxy(request: NextRequest) {
  // WebSocket upgrade requests should not be redirected - they'll be handled at the app level
  const isWebSocket =
    request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
    request.headers.get("connection")?.toLowerCase().includes("upgrade");

  if (isWebSocket) {
    return NextResponse.next();
  }

  if (shouldBypassAuthProxy(request)) {
    return NextResponse.next();
  }

  const identity = await getVerifiedSession(request.headers);

  if (identity) {
    return NextResponse.next();
  }

  // Anonymous (invalid/expired/orphaned session). Pick the base origin —
  // forwarded host when trusted (behind a reverse proxy), else AUTH_URL.
  const forwardedOrigin = getPublicOrigin(request);
  const base =
    forwardedOrigin && SERVER_CONFIG.TRUSTED_ORIGINS.includes(forwardedOrigin)
      ? forwardedOrigin
      : SERVER_CONFIG.AUTH_URL;

  // New visitors landing on the root get the public discovery page instead of a
  // forced sign-in. Deep links to authed pages still go to login with a
  // callbackUrl so the user returns there after signing in.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/discover", base), 307);
  }

  const loginUrl = new URL("/login", base);

  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl, 307);
}

function getPublicOrigin(request: NextRequest) {
  const h = request.headers;

  const proto = h.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) return null;

  return `${proto}://${host}`;
}

export const config = {
  matcher: [
    "/((?!api/auth|api/stripe|api/trpc|api/v1|trpc|pa/|_next|icons|images/splash|login|signup|auth-error|~offline|serwist/|manifest\\.webmanifest|sw\\.js|favicon\\.ico|favicon\\.svg|favicon-16x16\\.png|favicon-32x32\\.png|favicon-96x96\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|web-app-manifest-192x192\\.png|web-app-manifest-512x512\\.png|site\\.webmanifest|logo\\.svg|404\\.jpg|nora\\.jpg|mockup-norish\\.png|robots|sounds/).*)",
  ],
};
