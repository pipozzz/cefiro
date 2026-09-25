import { SERVER_CONFIG } from "@norish/config/env-config-server";

/**
 * The origin of the configured Plausible instance, derived from the per-site
 * script URL (`PLAUSIBLE_SRC`). This is the upstream the first-party `/pa/*`
 * routes proxy to. `null` when analytics is not configured, so the routes 404.
 */
export function plausibleOrigin(): string | null {
  const src = SERVER_CONFIG.PLAUSIBLE_SRC?.trim();

  if (!src) return null;

  try {
    return new URL(src).origin;
  } catch {
    return null;
  }
}
