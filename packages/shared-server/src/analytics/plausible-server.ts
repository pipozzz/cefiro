import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { serverLogger as log } from "@norish/shared-server/logger";

/**
 * Server-side Plausible pageview tracking.
 *
 * Instead of a browser script (which ad-blockers kill), the app sends each
 * pageview to Plausible's Events API from the server. There is no client script,
 * so nothing to block — the trade-off is that only server-visible signal is
 * captured (pageviews, visitors, referrers, countries, devices), not client-only
 * metrics like scroll depth or outbound clicks.
 *
 * On when PLAUSIBLE_DOMAIN and PLAUSIBLE_SRC are both set. The events endpoint is
 * the origin of PLAUSIBLE_SRC (the per-site script URL) + /api/event.
 */

function eventsEndpoint(): string | null {
  const src = SERVER_CONFIG.PLAUSIBLE_SRC?.trim();

  if (!src) return null;

  try {
    return `${new URL(src).origin}/api/event`;
  } catch {
    return null;
  }
}

export function isServerAnalyticsConfigured(): boolean {
  return Boolean(SERVER_CONFIG.PLAUSIBLE_DOMAIN?.trim() && eventsEndpoint());
}

export interface PageviewInput {
  /** Absolute URL of the page viewed. */
  url: string;
  /** The visitor's User-Agent — Plausible needs it (device breakdown + bot filtering). */
  userAgent: string | null;
  /** The visitor's IP, forwarded so Plausible attributes country/uniqueness. */
  ip: string | null;
  referer?: string | null;
}

/**
 * Send one pageview to Plausible. Best-effort: any failure is logged and
 * swallowed so it never affects the request. Plausible drops events with no
 * User-Agent or from datacenter IPs, so the real visitor UA + IP are forwarded.
 */
export async function trackPageview(input: PageviewInput): Promise<void> {
  const endpoint = eventsEndpoint();
  const domain = SERVER_CONFIG.PLAUSIBLE_DOMAIN?.trim();

  if (!endpoint || !domain || !input.userAgent) return;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": input.userAgent,
        "X-Forwarded-For": input.ip ?? "",
      },
      body: JSON.stringify({
        name: "pageview",
        domain,
        url: input.url,
        referrer: input.referer ?? "",
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    log.warn({ err }, "Server-side Plausible pageview failed");
  }
}
