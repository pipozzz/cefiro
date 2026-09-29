"use client";

import { useRouter } from "next/navigation";
import { useGroceriesMutations } from "@/hooks/groceries";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { Button, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

/** The servings-scaled ingredient shape the public recipe view already holds. */
type PublicIngredient = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
};

/**
 * A public ingredient line is addable when it is a real ingredient — not a
 * section header (`# ...`) and not a linked-recipe placeholder (`...(id:...)`).
 * The private panel also checks `ingredientId`, but the public payload omits it,
 * so we key off the name alone.
 */
function isAddable(name: string): boolean {
  const trimmed = name.trim();

  return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.includes("(id:");
}

/**
 * "Add to shopping list" on the public recipe page.
 *
 * The private page opens a selection panel backed by the owner-scoped recipe
 * fetch — unusable for a visitor who does not own the recipe. Here we instead
 * add the ingredients the page already shows (servings-scaled), so a reader can
 * shop a discovered recipe in one tap. Anonymous readers can't have a list, so
 * this variant is only mounted for signed-in visitors (see the auth-gated
 * sibling in recipe-view.tsx).
 */
export function AddToGroceriesPublicButton({
  ingredients,
  slug,
}: {
  ingredients: PublicIngredient[];
  slug: string;
}) {
  const t = useTranslations("social.recipe");
  const tPanel = useTranslations("groceries.panel");
  const router = useRouter();
  const { createGroceriesFromData } = useGroceriesMutations();

  const addable = ingredients.filter((i) => isAddable(i.ingredientName));

  if (addable.length === 0) {
    return null;
  }

  const onPress = () => {
    createGroceriesFromData(
      addable.map((i) => ({
        name: i.ingredientName,
        amount: i.amount ?? null,
        unit: i.unit ?? null,
        isDone: false,
      }))
    )
      .then(() => {
        toast.success(tPanel("ingredientsAdded"), {
          actionProps: {
            children: t("viewGroceries"),
            onPress: () => router.push("/groceries"),
          },
        });
      })
      .catch((error: unknown) => {
        // An expired session mid-visit: send them to log in and back, matching
        // the save/like buttons on this row.
        if (
          typeof error === "object" &&
          error !== null &&
          "data" in error &&
          (error as { data?: { code?: string } }).data?.code === "UNAUTHORIZED"
        ) {
          router.push(`/login?callbackUrl=/r/${slug}`);

          return;
        }

        showSafeErrorToast({
          title: tPanel("ingredientsFailed"),
          description: tPanel("ingredientsFailed"),
          error,
          context: "social.addToGroceries",
        });
      });
  };

  return (
    <Button size="sm" variant="secondary" onPress={onPress}>
      <ShoppingCartIcon className="h-4 w-4" />
      {t("addToGroceries")}
    </Button>
  );
}

/**
 * The anonymous counterpart: no list to add to, so it simply routes to login
 * and returns the reader to this recipe. Kept as a separate component so the
 * grocery mutation hooks are only ever mounted for signed-in visitors.
 */
export function AddToGroceriesSignInButton({ slug }: { slug: string }) {
  const t = useTranslations("social.recipe");
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      onPress={() => router.push(`/login?callbackUrl=/r/${slug}`)}
    >
      <ShoppingCartIcon className="h-4 w-4" />
      {t("addToGroceries")}
    </Button>
  );
}
