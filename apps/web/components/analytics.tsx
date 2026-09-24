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
 * Rendered from the dynamic root layout, so the DB value is read per request
 * (no rebuild needed). A read failure degrades to env / off, never a crash.
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

  // The full Plausible snippet: the deferred loader plus the `window.plausible`
  // queue shim, so custom events (`plausible('Signup')`, tagged events, etc.)
  // work even before the script has loaded. Emitted into the server-rendered
  // HTML so it loads without blocking.
  return (
    <>
      <script defer data-domain={domain} src={src} />
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html:
            "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}",
        }}
      />
    </>
  );
}
