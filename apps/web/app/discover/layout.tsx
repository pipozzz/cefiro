import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/app/(app)/app-shell";
import { PublicHeader } from "@/components/social/public-header";
import { amountDisplayPreference } from "@/lib/amount-display";
import { hiddenItemsPreference } from "@/lib/hidden-items";
import { recipePageColorPreference } from "@/lib/recipe-page-color";
import { todaysMealsVisibilityPreference } from "@/lib/todays-meals-visibility";
import { getTranslations } from "next-intl/server";

import { auth } from "@norish/auth/auth";

import { BaseProviders } from "../providers/base-providers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("social.discover");
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    openGraph: { type: "website", title, description, siteName: "Cefiro" },
    twitter: { card: "summary", title, description },
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
    const cookieStore = await cookies();

    return (
      <AppShell
        initialAmountDisplayMode={amountDisplayPreference.readFrom(cookieStore)}
        initialHiddenItems={hiddenItemsPreference.readFrom(cookieStore)}
        initialRecipePageColor={recipePageColorPreference.readFrom(cookieStore)}
        initialTodaysMealsVisibility={todaysMealsVisibilityPreference.readFrom(cookieStore)}
      >
        {children}
      </AppShell>
    );
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
