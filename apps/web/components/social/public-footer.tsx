import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * A small footer for the public, logged-out surface. Its main job is to surface
 * — and internally link — the About and legal pages on every public page, which
 * matters for discoverability and search-engine trust (E-A-T). Logged-in users
 * navigate via the app shell, so this is only rendered on the public chrome.
 */
export async function PublicFooter() {
  const t = await getTranslations("social.footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-border mt-16 border-t px-4 py-8 md:px-6 print:hidden">
      <div className="text-default-500 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <span>© {year} Naša Kuchyňa</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link className="hover:text-foreground transition" href="/about">
            {t("about")}
          </Link>
          <Link className="hover:text-foreground transition" href="/terms">
            {t("terms")}
          </Link>
          <Link className="hover:text-foreground transition" href="/privacy">
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
