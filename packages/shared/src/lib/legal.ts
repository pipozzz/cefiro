/**
 * Legal document versioning.
 *
 * A single version string covers the Terms of Service and Privacy Policy
 * together. Bump it (to the date of the change) whenever either document
 * changes materially; new sign-ups record the version they accepted, so a bump
 * marks the boundary between who accepted what.
 */
export const LEGAL_VERSION = "2026-09-25";

export const LEGAL_PATHS = {
  terms: "/terms",
  privacy: "/privacy",
} as const;
