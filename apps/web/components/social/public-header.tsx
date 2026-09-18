import { headers } from "next/headers";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { getTranslations } from "next-intl/server";

import { auth } from "@norish/auth/auth";

/**
 * The chrome shared by the public, logged-out-friendly pages (discover and the
 * `/r/[slug]` recipe view). Rendering the same header on both means the menu
 * never disappears when a visitor clicks from discover into a recipe, and the
 * two pages read as one surface. Signed-in visitors get a link back into the
 * app; everyone else gets a sign-in call to action.
 */
export async function PublicHeader() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAuthed = !!session?.user?.id;
  const t = await getTranslations("social.discover");

  return (
    <header className="flex items-center justify-between px-4 py-4 md:px-6">
      <Link aria-label="Cefiro" className="flex items-center" href={isAuthed ? "/" : "/discover"}>
        <BrandLogo priority height={28} width={112} />
      </Link>
      {isAuthed ? (
        <Link className="text-primary text-sm font-medium hover:underline" href="/">
          {t("openApp")}
        </Link>
      ) : (
        <Link
          className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 text-sm font-medium transition hover:opacity-90"
          href="/login"
        >
          {t("signIn")}
        </Link>
      )}
    </header>
  );
}
