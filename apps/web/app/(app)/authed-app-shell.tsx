import { cookies } from "next/headers";
import { AppShell } from "@/app/(app)/app-shell";
import { amountDisplayPreference } from "@/lib/amount-display";
import { hiddenItemsPreference } from "@/lib/hidden-items";
import { recipePageColorPreference } from "@/lib/recipe-page-color";
import { todaysMealsVisibilityPreference } from "@/lib/todays-meals-visibility";

/**
 * The full signed-in app shell (navbar + every recipe/filter provider), seeded
 * from the device-preference cookies exactly as `(app)/layout.tsx` does.
 *
 * Shared by the public social routes (`/discover`, `/r`, `/u`, `/c`), which
 * render outside the `(app)` group: a signed-in visitor keeps the app navigation
 * there instead of dropping to public chrome when they open a recipe, profile or
 * cookbook. Signed-out visitors still get the public layout in each route.
 */
export async function AuthedAppShell({ children }: { children: React.ReactNode }) {
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
