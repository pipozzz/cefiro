import { SERVER_CONFIG } from "@norish/config/env-config-server";

/**
 * Branding shared by every outbound email (and reused by push). Kept in one
 * place so the app name and logo can't drift between templates.
 */

/** The instance's public display name. */
export const APP_NAME = "Naša Kuchyňa";

/** The app's public base URL, without a trailing slash. */
export function appUrl(): string {
  return SERVER_CONFIG.AUTH_URL.replace(/\/+$/, "");
}

/**
 * Absolute URL to the brand logo for email headers.
 *
 * A PNG, not the SVG: most mail clients (Gmail, Outlook) refuse to render SVG.
 * Served from the web app's public root, so it resolves for recipients even
 * when the mail was sent from the worker process.
 */
export function logoUrl(): string {
  return `${appUrl()}/android-chrome-192x192.png`;
}

/** Brand green — the CTA and link colour, matching the app theme. */
export const BRAND_COLOR = "#336640";
