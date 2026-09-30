export type FooterLink = { label: string; url: string };

/**
 * The links a footer shows: the built-in localized links (About/Terms/Privacy)
 * always come first, then any admin-configured links that aren't already one of
 * them (de-duplicated by URL). Shared by the public (server) footer and the
 * in-app (client) footer so both merge identically.
 */
export function mergeFooterLinks(
  defaults: readonly FooterLink[],
  configured: readonly FooterLink[]
): FooterLink[] {
  const defaultUrls = new Set(defaults.map((link) => link.url));

  return [...defaults, ...configured.filter((link) => !defaultUrls.has(link.url))];
}
