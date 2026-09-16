import { useMemo, useState } from "react";

import type { MeasurementSystem } from "@norish/shared/contracts";

import type { ShareIngredient, ShareRecipeState } from "./types";

export function useShareRecipeState(recipe: {
  servings: number | null;
  systemUsed: MeasurementSystem;
  recipeIngredients: ShareIngredient[];
}): ShareRecipeState {
  // A recipe may have no stated yield (null); fall back to 1 so scaling is a
  // no-op rather than dividing by zero.
  const baseServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  const [servings, setServings] = useState(Math.max(0.125, baseServings));
  const [activeSystem, setActiveSystem] = useState<MeasurementSystem>(recipe.systemUsed);
  const availableSystems = useMemo(
    () =>
      Array.from(
        new Set(recipe.recipeIngredients.map((ingredient) => ingredient.systemUsed))
      ) as MeasurementSystem[],
    [recipe.recipeIngredients]
  );
  const ratio = servings / baseServings;
  const adjustedIngredients = useMemo(
    () =>
      recipe.recipeIngredients.map((ingredient) => ({
        ...ingredient,
        amount: ingredient.amount != null ? ingredient.amount * ratio : null,
      })),
    [recipe.recipeIngredients, ratio]
  );

  return {
    servings,
    setServings,
    activeSystem,
    setActiveSystem,
    availableSystems,
    adjustedIngredients,
  };
}
