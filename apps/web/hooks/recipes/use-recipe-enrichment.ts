"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/user-context";
import { isAiUpgradeError } from "@/lib/ui/ai-upgrade-error";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

const sharedUseRecipeEnrichment = sharedRecipeFamilyHooks.useRecipeEnrichment;

/**
 * Recipe Enrichment lifecycle and manual requests for every kind.
 *
 * Only failures of runs this user asked for surface as a toast. Automatic
 * enrichment stays quiet: it is optional background work, and an error there
 * would read as the recipe itself having failed.
 */
export function useRecipeEnrichment(recipeId: string) {
  const { user } = useUserContext();
  const t = useTranslations("recipes.enrichment");
  const tErrors = useTranslations("common.errors");
  const router = useRouter();

  const onManualError = useCallback(
    (kind: RecipeEnrichmentKind, error: unknown) => {
      // An entitlement gate (out of AI credits, or a plan without image
      // generation) is an upgrade prompt, not a failed run.
      if (isAiUpgradeError(error)) {
        toast(tErrors("aiLimit.title"), {
          description: tErrors("aiLimit.description"),
          actionProps: {
            children: tErrors("aiLimit.upgrade"),
            onPress: () => router.push("/settings?tab=billing"),
          },
        });

        return;
      }

      toast(t("failed"), {
        variant: "danger",
        description: error instanceof Error && error.message ? error.message : t(`kinds.${kind}`),
      });
    },
    [t, tErrors, router]
  );

  return sharedUseRecipeEnrichment(recipeId, user?.id ?? null, { onManualError });
}
