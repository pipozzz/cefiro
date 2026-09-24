"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeCard } from "@/components/social/social-recipe-card";
import { CheckCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Spinner, toast } from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { RouterOutputs } from "@norish/trpc/client";
import { useSession } from "@norish/shared/lib/auth/client";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import { FridgeMenu } from "./fridge-menu";

type FridgeRecipe = RouterOutputs["social"]["searchByIngredients"]["recipes"][number];

/**
 * "Cook with what you have": the reader lists ingredients they have on hand and
 * gets public recipes ranked by how many of them each uses. Each result shows
 * what is still missing and — for a signed-in reader — adds the gap to the
 * shopping list in one tap, closing the fridge → shop → cook loop.
 */
export function IngredientDiscovery() {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");
  const { data: session } = useSession();
  const canShop = !!session?.user;
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const addChip = (raw: string) => {
    const value = raw.trim().toLowerCase();

    if (!value) {
      return;
    }

    setChips((current) =>
      current.includes(value) || current.length >= 10 ? current : [...current, value]
    );
    setInput("");
  };

  const removeChip = (value: string) => setChips((current) => current.filter((c) => c !== value));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && input === "" && chips.length > 0) {
      setChips((current) => current.slice(0, -1));
    }
  };

  const { data, isLoading, isFetching } = useQuery({
    ...trpc.social.searchByIngredients.queryOptions({ ingredients: chips, limit: 24 }),
    enabled: chips.length > 0,
    // Adding/removing a chip changes the query key. Without this the grid would
    // drop to a full-height spinner on every edit — read as the whole page
    // flickering. Keep the previous results visible and just fade them while the
    // new set loads.
    placeholderData: keepPreviousData,
    retry: false,
  });

  const recipes = data?.recipes ?? [];
  // Only the very first search (no results yet) shows the big spinner; later
  // edits refetch underneath the existing grid.
  const showSpinner = isLoading && recipes.length === 0;

  return (
    <div>
      <label className="bg-field shadow-field focus-within:border-accent/60 focus-within:ring-accent/20 flex flex-wrap items-center gap-2 rounded-3xl border border-transparent px-4 py-2.5 transition-colors focus-within:ring-2">
        <MagnifyingGlassIcon className="text-muted h-5 w-5 shrink-0" />
        {chips.map((chip) => (
          <span
            key={chip}
            className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-medium"
          >
            {chip}
            <button
              aria-label={t("clearTag")}
              className="hover:bg-primary/20 rounded-full p-0.5"
              type="button"
              onClick={() => removeChip(chip)}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </span>
        ))}
        <input
          aria-label={t("ingredientPlaceholder")}
          className="text-foreground placeholder:text-muted min-w-[8rem] flex-1 bg-transparent py-1 text-[15px] outline-none"
          placeholder={chips.length === 0 ? t("ingredientPlaceholder") : ""}
          value={input}
          onBlur={() => addChip(input)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <p className="text-default-500 mt-2 text-sm">{t("ingredientHint")}</p>

      <div className="mt-8">
        {chips.length === 0 ? null : showSpinner ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner />
          </div>
        ) : recipes.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
            {t("noIngredientResults")}
          </p>
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <FridgeMenu canShop={canShop} recipes={recipes} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {recipes.map((recipe) => (
                <div key={recipe.slug} className="flex flex-col gap-2">
                  <SocialRecipeCard recipe={recipe} />
                  <FridgeFooter canShop={canShop} recipe={recipe} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Per-result "have / missing" line, plus an add-the-gap-to-groceries button
 * for signed-in readers. Its own component so each card owns its mutation. */
function FridgeFooter({ recipe, canShop }: { recipe: FridgeRecipe; canShop: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.discover");
  const [added, setAdded] = useState(false);

  const addMutation = useMutation(
    trpc.groceries.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.groceries.list.queryKey() });
        setAdded(true);
        toast(t("missingAdded", { count: recipe.missing.length }));
      },
    })
  );

  if (recipe.total === 0) {
    return null;
  }

  if (recipe.missing.length === 0) {
    return (
      <p className="text-success inline-flex items-center gap-1 px-1 text-xs font-medium">
        <CheckCircleIcon className="h-4 w-4" />
        {t("fridgeHaveAll")}
      </p>
    );
  }

  const shown = recipe.missing.slice(0, 4).join(", ");
  const more = recipe.missing.length > 4 ? "…" : "";

  return (
    <div className="flex flex-col gap-1 px-1">
      <p className="text-default-500 text-xs">
        <span className="text-default-600 font-medium">
          {t("fridgeHave", { have: recipe.have, total: recipe.total })}
        </span>{" "}
        · {t("fridgeMissing")}: {shown}
        {more}
      </p>
      {canShop ? (
        <Button
          className="self-start rounded-full text-xs"
          isDisabled={added}
          isPending={addMutation.isPending}
          size="sm"
          variant="tertiary"
          onPress={() =>
            addMutation.mutate(
              recipe.missing.map((name) => ({
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
          {added ? t("missingAddedShort") : t("addMissing")}
        </Button>
      ) : null}
    </div>
  );
}
