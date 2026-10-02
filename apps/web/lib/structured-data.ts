/**
 * schema.org JSON-LD builders for the public SEO surfaces. Kept as plain data
 * builders (no rendering) so they're easy to unit-test and reuse; the `JsonLd`
 * component renders whatever these return.
 */

type JsonLdObject = Record<string, unknown>;

/** A SERP breadcrumb trail (Home › Discover › …). Absolute URLs. */
export function breadcrumbListLd(items: { name: string; url: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * A hub page as an ordered list of recipe URLs — tells search engines the
 * category/cuisine/tag/theme page is a curated collection, not a generic page.
 */
export function recipeItemListLd(input: {
  name: string;
  url: string;
  recipeUrls: string[];
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: input.url,
    numberOfItems: input.recipeUrls.length,
    itemListElement: input.recipeUrls.map((recipeUrl, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: recipeUrl,
    })),
  };
}
