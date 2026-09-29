import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthedAppShell } from "@/app/(app)/authed-app-shell";
import { PublicHeader } from "@/components/social/public-header";
import { getTranslations } from "next-intl/server";

import { auth } from "@norish/auth/auth";

import { BaseProviders } from "../providers/base-providers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.discover");
  const title = t("metaTitle");
  const description = t("metaDescription");

  // Absolute canonical for discovery. The proxy also serves this page at the bare
  // root ("/") as an alias, so pinning the canonical to /discover keeps the root
  // and /discover from competing as duplicate content while both share the card.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const url = host ? `${proto}://${host}/discover` : undefined;

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "Naša Kuchyňa",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Naša Kuchyňa" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-default.png"] },
  };
}

/**
 * Discovery is the app's primary recipe-search surface, so it renders in two
 * contexts from one route (it bypasses the auth proxy — see
 * `lib/recipe-share-access.ts`). A signed-in visitor gets the full app shell
 * (navbar + every recipe/filter provider), so discovery is native rather than
 * a place they leave the app to reach; a signed-out visitor gets the public
 * chrome, keeping `/discover` crawlable and shareable.
 */
export default async function DiscoverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    return <AuthedAppShell>{children}</AuthedAppShell>;
  }

  return (
    <BaseProviders>
      <div className="min-h-dvh">
        <PublicHeader />
        {children}
      </div>
    </BaseProviders>
  );
}
