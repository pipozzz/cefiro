/**
 * URL slug for a cuisine name — cuisines are free-text vocabulary (not a fixed
 * enum), so the slug is derived: lowercased, diacritics stripped, non-alphanumerics
 * collapsed to hyphens. e.g. "Stredomorská" → "stredomorska". Resolve a slug back
 * by matching it against the slugs of the known cuisines.
 */
export function cuisineSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
