import { cookies } from "next/headers";
import { PublicHeader } from "@/components/social/public-header";
import { AmountDisplayProvider } from "@/context/amount-display-context";
import { RecipePageColorProvider } from "@/context/recipe-page-color-context";
import { amountDisplayPreference } from "@/lib/amount-display";
import { recipePageColorPreference } from "@/lib/recipe-page-color";

import { BaseProviders } from "../../providers/base-providers";

export default async function PublicRecipeLayout({ children }: { children: React.ReactNode }) {
  // The interactive cooking view (scaled ingredients, timer-aware steps) reads
  // the amount-format and page-color device preferences. They live in cookies,
  // not the account, so a signed-out reader still gets their own format; the
  // server pass seeds them here exactly as the share route does.
  const cookieStore = await cookies();

  return (
    <BaseProviders>
      <AmountDisplayProvider initialValue={amountDisplayPreference.readFrom(cookieStore)}>
        <RecipePageColorProvider initialValue={recipePageColorPreference.readFrom(cookieStore)}>
          <div className="min-h-dvh">
            <PublicHeader />
            {children}
          </div>
        </RecipePageColorProvider>
      </AmountDisplayProvider>
    </BaseProviders>
  );
}
