import Script from "next/script";

import { getAnalyticsConfig } from "@norish/shared-server/config/server-config-loader";

/**
 * Plausible analytics — privacy-friendly and cookieless (no GDPR consent banner
 * needed). Configured from the admin settings (DB), with env as a fallback, so
 * an admin can turn it on / point it at a self-hosted instance from the UI
 * without a redeploy. Off entirely until a script src (or a domain) is set.
 *
 * Resolution (first non-empty wins):
 *   src    — admin `analytics_config.plausibleSrc`     →  env PLAUSIBLE_SRC
 *            →  Plausible Cloud legacy script (only when a domain is set)
 *   domain — admin `analytics_config.plausibleDomain`  →  env PLAUSIBLE_DOMAIN
 *
 * Two things this MUST get right, both learned the hard way against the live
 * instance:
 *
 * 1. `next/script`, never a raw <script>. A bare tracker <script> in the App
 *    Router <head> is re-inserted by React on hydration, so `document.currentScript`
 *    is null when it runs and the legacy tracker can't read its own config.
 *
 * 2. The init snippet must define `plausible.init` AND call `plausible.init()`.
 *    The current Plausible script (the per-site `/js/pa-*.js` build) does NOT
 *    auto-start: it waits for `plausible.init()` and reads its config from
 *    `plausible.o`. The older queue-only stub (define `plausible`, no init) loads
 *    the script but never fires a pageview — which is exactly the "loads but no
 *    data" symptom. `plausible.init()` is harmless for the legacy `script.js`
 *    (which auto-tracks via `data-domain`), so one snippet serves both.
 */
export async function Analytics() {
  const config = await getAnalyticsConfig().catch(() => ({}));

  /* eslint-disable no-restricted-properties */
  const domain = config.plausibleDomain?.trim() || process.env.PLAUSIBLE_DOMAIN;
  const src =
    config.plausibleSrc?.trim() ||
    process.env.PLAUSIBLE_SRC ||
    (domain ? "https://plausible.io/js/script.js" : undefined);
  /* eslint-enable no-restricted-properties */

  if (!src) {
    return null;
  }

  return (
    <>
      {/* `data-domain` is required by the legacy `script.js` and ignored by the
          per-site `pa-*.js` build (which has the domain baked into its URL), so
          it is emitted only when configured and is safe for both. */}
      <Script
        async
        src={src}
        strategy="afterInteractive"
        {...(domain ? { "data-domain": domain } : {})}
      />
      {/* Queue shim + init. `plausible.init()` is what actually starts the
          current tracker; without it the script loads but no pageview fires. */}
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
      </Script>
    </>
  );
}
