import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getNavigationConfig } from "@norish/shared-server/config/server-config-loader";

/**
 * A small footer for the public, logged-out surface. Its main job is to surface
 * — and internally link — the About and legal pages on every public page, which
 * matters for discoverability and search-engine trust (E-A-T). Logged-in users
 * navigate via the app shell, so this is only rendered on the public chrome.
 *
 * Links come from the admin-editable navigation config when set; otherwise the
 * built-in localized About/Terms/Privacy links are used, so an unconfigured
 * instance is unchanged.
 */
export async function PublicFooter() {
  const t = await getTranslations("social.footer");
  const { footer } = await getNavigationConfig();
  const year = new Date().getFullYear();

  // The built-in localized links always show; admin-configured links EXTEND them
  // (rather than replacing), appended after and de-duplicated by URL so adding
  // one link never drops About/Terms/Privacy.
  const defaults = [
    { label: t("about"), url: "/about" },
    { label: t("terms"), url: "/terms" },
    { label: t("privacy"), url: "/privacy" },
  ];
  const defaultUrls = new Set(defaults.map((link) => link.url));
  const links = [...defaults, ...footer.filter((link) => !defaultUrls.has(link.url))];

  return (
    <footer className="border-border mt-16 border-t px-4 py-8 md:px-6 print:hidden">
      <div className="text-default-500 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <span>© {year} Naša Kuchyňa</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {links.map((link) => (
            <Link
              key={`${link.label}:${link.url}`}
              className="hover:text-foreground transition"
              href={link.url}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
