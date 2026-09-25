import { after, NextRequest, NextResponse } from "next/server";
import { shouldBypassAuthProxy } from "@/lib/recipe-share-access";

import { getVerifiedSession } from "@norish/auth/session";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  isServerAnalyticsConfigured,
  trackPageview,
} from "@norish/shared-server/analytics/plausible-server";

/**
 * Server-side Plausible pageview: fire from the proxy so there is no client
 * script for ad-blockers to block. Only real page navigations count — a document
 * load (sec-fetch-dest: document) or a client RSC navigation (RSC: 1) that is not
 * a speculative prefetch — so media, RSC prefetches and sub-resources are
 * ignored. Runs after the response (`after`) and never blocks it.
 */
function trackPageviewIfNavigation(request: NextRequest): void {
  if (request.method !== "GET" || !isServerAnalyticsConfigured()) return;

  const headers = request.headers;

  if (headers.get("next-router-prefetch") === "1" || headers.get("purpose") === "prefetch") {
    return;
  }

  const dest = headers.get("sec-fetch-dest");
  const accept = headers.get("accept") ?? "";
  const isDocument = dest === "document" || (!dest && accept.includes("text/html"));
  const isClientNavigation = headers.get("rsc") === "1";

  if (!isDocument && !isClientNavigation) return;

  const origin = getPublicOrigin(request) ?? SERVER_CONFIG.AUTH_URL;
  const url = `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const ip = (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;

  after(() =>
    trackPageview({
      url,
      userAgent: headers.get("user-agent"),
      ip,
      referer: headers.get("referer"),
    })
  );
}

export async function proxy(request: NextRequest) {
  // WebSocket upgrade requests should not be redirected - they'll be handled at the app level
  const isWebSocket =
    request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
    request.headers.get("connection")?.toLowerCase().includes("upgrade");

  if (isWebSocket) {
    return NextResponse.next();
  }

  if (shouldBypassAuthProxy(request)) {
    trackPageviewIfNavigation(request);

    return NextResponse.next();
  }

  const identity = await getVerifiedSession(request.headers);

  if (identity) {
    trackPageviewIfNavigation(request);

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
    "/((?!api/auth|api/stripe|api/trpc|api/v1|trpc|_next|icons|images/splash|login|signup|auth-error|~offline|serwist/|manifest\\.webmanifest|sw\\.js|favicon\\.ico|favicon\\.svg|favicon-16x16\\.png|favicon-32x32\\.png|favicon-96x96\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|web-app-manifest-192x192\\.png|web-app-manifest-512x512\\.png|site\\.webmanifest|logo\\.svg|404\\.jpg|nora\\.jpg|mockup-norish\\.png|robots|sounds/).*)",
  ],
};
