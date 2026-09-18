"use client";

import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";
import { PublicServingsControl } from "@/components/recipes/public-servings-control";

import { usePublicRecipeContext } from "../public/public-recipe-context";
import { ShareSystemSwitcher } from "./share-system-switcher";

export function ShareRecipeControls() {
  const { state } = usePublicRecipeContext();

  return (
    <>
      <AmountDisplayToggle />
      <PublicServingsControl servings={state.servings} onChange={state.setServings} />
      <ShareSystemSwitcher
        activeSystem={state.activeSystem}
        availableSystems={state.availableSystems}
        onChange={state.setActiveSystem}
      />
    </>
  );
}
