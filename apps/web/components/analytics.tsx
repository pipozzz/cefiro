/**
 * Plausible analytics — a privacy-friendly, cookieless tracker (no GDPR consent
 * banner needed). Rendered only when `PLAUSIBLE_DOMAIN` is set, so it is off by
 * default and turns on per-deploy via env. Read at request time (this is a
 * server component under the dynamic root layout), so a runtime env value is
 * picked up without a rebuild.
 *
 * Env:
 *   PLAUSIBLE_DOMAIN  the site's `data-domain` (e.g. "nasakuchyna.sk"). Required.
 *   PLAUSIBLE_SRC     script URL; defaults to Plausible Cloud. Set this to your
 *                     own instance's script for self-hosted Plausible.
 */
export function Analytics() {
  /* eslint-disable no-restricted-properties */
  const domain = process.env.PLAUSIBLE_DOMAIN;
  const src = process.env.PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";
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
