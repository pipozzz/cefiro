"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { CheckCircleIcon, ShoppingCartIcon } from "@heroicons/react/16/solid";
import { Button, toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { RouterOutputs } from "@norish/trpc/client";
import { createClientId } from "@norish/shared/lib/operation-helpers";

type FridgeRecipe = RouterOutputs["social"]["searchByIngredients"]["recipes"][number];

/** How many recipes make up a suggested menu. */
const MENU_SIZE = 3;

/**
 * "Shop once, cook several": from the fridge search results, pick the few
 * recipes the reader can most nearly make and merge everything they are still
 * missing into a single shopping add. The point is not a formal three-course
 * menu — it is that a cook can plan a handful of meals around what they already
 * have and buy the gap in one trip, instead of shopping per recipe.
 *
 * Chooses the recipes closest to complete (fewest missing, then most matched),
 * and de-duplicates the combined missing list case-insensitively so an
 * ingredient two recipes both need is bought once. Signed-in only, since it
 * writes to the shopping list; renders nothing without at least two candidates.
 */
export function FridgeMenu({ recipes, canShop }: { recipes: FridgeRecipe[]; canShop: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.discover");
  const [added, setAdded] = useState(false);

  const menu = useMemo(() => {
    return [...recipes]
      .filter((recipe) => recipe.total > 0)
      .sort((a, b) => a.missing.length - b.missing.length || b.have - a.have)
      .slice(0, MENU_SIZE);
  }, [recipes]);

  // The combined shopping gap, each ingredient once (first spelling wins).
  const combinedMissing = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const recipe of menu) {
      for (const name of recipe.missing) {
        const key = name.trim().toLowerCase();

        if (key.length > 0 && !seen.has(key)) {
          seen.add(key);
          out.push(name);
        }
      }
    }

    return out;
  }, [menu]);

  const addMutation = useMutation(
    trpc.groceries.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.groceries.list.queryKey() });
        setAdded(true);
        toast(t("missingAdded", { count: combinedMissing.length }));
      },
    })
  );

  // A menu needs at least a couple of recipes to be worth assembling.
  if (menu.length < 2) {
    return null;
  }

  return (
    <section className="border-default-200 bg-content1 mb-8 rounded-3xl border p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-foreground text-lg font-semibold">{t("fridgeMenuTitle")}</h3>
        <p className="text-default-500 text-sm">{t("fridgeMenuSubtitle")}</p>
      </div>

      <ul className="mb-4 flex flex-col gap-2">
        {menu.map((recipe) => (
          <li key={recipe.slug} className="flex items-center justify-between gap-3">
            <Link
              className="text-foreground hover:text-primary min-w-0 truncate font-medium transition"
              href={`/r/${recipe.slug}`}
            >
              {recipe.name}
            </Link>
            <span
              className={`shrink-0 text-xs font-medium ${
                recipe.missing.length === 0 ? "text-success" : "text-default-500"
              }`}
            >
              {t("fridgeHave", { have: recipe.have, total: recipe.total })}
            </span>
          </li>
        ))}
      </ul>

      {combinedMissing.length === 0 ? (
        <p className="text-success inline-flex items-center gap-1 text-sm font-medium">
          <CheckCircleIcon className="h-4 w-4" />
          {t("fridgeMenuAllStocked")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-default-500 text-xs">
            {t("fridgeMissing")}: {combinedMissing.slice(0, 8).join(", ")}
            {combinedMissing.length > 8 ? "…" : ""}
          </p>
          {canShop ? (
            <Button
              className="self-start rounded-full"
              isDisabled={added}
              isPending={addMutation.isPending}
              size="sm"
              startContent={<ShoppingCartIcon className="h-4 w-4" />}
              variant="primary"
              onPress={() =>
                addMutation.mutate(
                  combinedMissing.map((name) => ({
                    id: createClientId(),
                    name,
                    amount: null,
                    unit: null,
                    purchaseAmount: null,
                    isDone: false,
                    recipeIngredientId: null,
                  }))
                )
              }
            >
              {added
                ? t("missingAddedShort")
                : t("fridgeMenuShopAll", { count: combinedMissing.length })}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default FridgeMenu;
