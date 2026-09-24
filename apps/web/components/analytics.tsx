import Script from "next/script";

import { getAnalyticsConfig } from "@norish/shared-server/config/server-config-loader";

/**
 * Plausible analytics — privacy-friendly and cookieless (no GDPR consent banner
 * needed). Configured from the admin settings (DB), with env as a fallback, so
 * an admin can turn it on / point it at a self-hosted instance from the UI
 * without a redeploy. Off entirely until a domain is set.
 *
 * Resolution (first non-empty wins):
 *   domain — admin `analytics_config.plausibleDomain`  →  env PLAUSIBLE_DOMAIN
 *   src    — admin `analytics_config.plausibleSrc`     →  env PLAUSIBLE_SRC
 *            →  Plausible Cloud
 *
 * Uses `next/script` rather than a raw <script> tag: a bare tracker <script>
 * rendered into the App Router <head> is re-inserted by React on hydration, so
 * `document.currentScript` is null when it runs and Plausible never reads its
 * `data-domain` / never initializes (it loads, but no pageviews fire).
 * next/script injects it imperatively, so the tracker initializes correctly and
 * auto-tracks SPA navigations. Read at request time (dynamic root layout), so a
 * DB value is picked up without a rebuild; a read failure degrades to env / off.
 */
export async function Analytics() {
  const config = await getAnalyticsConfig().catch(() => ({}));

  /* eslint-disable no-restricted-properties */
  const domain = config.plausibleDomain?.trim() || process.env.PLAUSIBLE_DOMAIN;
  const src =
    config.plausibleSrc?.trim() || process.env.PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
  /* eslint-enable no-restricted-properties */

  if (!domain) {
    return null;
  }

  return (
    <>
      <Script defer data-domain={domain} src={src} strategy="afterInteractive" />
      {/* The `window.plausible` queue shim, so custom events queued before the
          tracker finishes loading are still captured. */}
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
      </Script>
    </>
  );
}
