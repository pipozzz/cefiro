import { headers } from "next/headers";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { getTranslations } from "next-intl/server";

import { auth } from "@norish/auth/auth";
import { getNavigationConfig } from "@norish/shared-server/config/server-config-loader";

/**
 * The chrome shared by the public, logged-out-friendly pages (discover and the
 * `/r/[slug]` recipe view). Rendering the same header on both means the menu
 * never disappears when a visitor clicks from discover into a recipe, and the
 * two pages read as one surface. Signed-in visitors get a link back into the
 * app; everyone else gets a sign-in call to action.
 *
 * Admin-configured header links (navigation config) render between the logo and
 * the call to action; an unconfigured instance shows just the logo and CTA.
 */
export async function PublicHeader() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAuthed = !!session?.user?.id;
  const t = await getTranslations("social.discover");
  const { header } = await getNavigationConfig();

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-4 md:px-6 print:hidden">
      <Link
        aria-label="Naša Kuchyňa"
        className="flex shrink-0 items-center"
        href={isAuthed ? "/" : "/discover"}
      >
        <BrandLogo priority height={28} width={112} />
      </Link>
      {header.length > 0 && (
        <nav className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:flex">
          {header.map((link) => (
            <Link
              key={`${link.label}:${link.url}`}
              className="text-default-600 hover:text-foreground transition"
              href={link.url}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      {isAuthed ? (
        <Link className="text-primary shrink-0 text-sm font-medium hover:underline" href="/">
          {t("openApp")}
        </Link>
      ) : (
        <Link
          className="bg-primary text-primary-foreground shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition hover:opacity-90"
          href="/login"
        >
          {t("signIn")}
        </Link>
      )}
    </header>
  );
}
