import Script from "next/script";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

/**
 * Plausible analytics — cookieless, and served **first-party** so ad-blockers
 * can't block it. The tracker is proxied through this app at runtime:
 *   - `src="/pa/js"` streams the Plausible script (see app/pa/js/route.ts)
 *   - `data-api="/pa/event"` sends events to our own domain, which the
 *     `/pa/event` route forwards to the Plausible instance with the real IP/UA.
 *
 * Runtime-configured (works with a pre-built image): rendered only when
 * PLAUSIBLE_DOMAIN is set, and the routes are off unless PLAUSIBLE_SRC is set.
 *
 * `next/script` (not a raw <script>) because a bare tracker tag in the App
 * Router is re-inserted on hydration with `document.currentScript` null, so the
 * classic script can't read its own `data-domain` / `data-api` and never starts.
 */
export function Analytics() {
  const domain = SERVER_CONFIG.PLAUSIBLE_DOMAIN?.trim();

  if (!domain) return null;

  return (
    <>
      <Script
        defer
        data-api="/pa/event"
        data-domain={domain}
        src="/pa/js"
        strategy="afterInteractive"
      />
      {/* Queue shim so custom events fired before the script loads are kept. */}
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
      </Script>
    </>
  );
}
