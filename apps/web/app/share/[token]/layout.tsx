import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AmountDisplayProvider } from "@/context/amount-display-context";
import { RecipePageColorProvider } from "@/context/recipe-page-color-context";
import { amountDisplayPreference } from "@/lib/amount-display";
import { recipePageColorPreference } from "@/lib/recipe-page-color";

/**
 * A shared recipe is read signed-out, but the amount format is a device
 * preference, not an account one — the cookie rides along and the server
 * pass seeds it so amounts arrive in the reader's format here too.
 */
/**
 * Token-based share links are private and must never be indexed or followed by
 * crawlers — keep this minimal (no recipe fetch, no OG tags) so these links get
 * neither search visibility nor a rich preview.
 */
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function SharedRecipeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  return (
    <AmountDisplayProvider initialValue={amountDisplayPreference.readFrom(cookieStore)}>
      <RecipePageColorProvider initialValue={recipePageColorPreference.readFrom(cookieStore)}>
        {children}
      </RecipePageColorProvider>
    </AmountDisplayProvider>
  );
}
