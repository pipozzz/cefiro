"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useWarmSet } from "@/hooks/use-warm-set";
import { isAiUpgradeError } from "@/lib/ui/ai-upgrade-error";
import { isQueuedForReplay, showQueuedOfflineToast } from "@/lib/ui/queued-offline-toast";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipesMutationsResult } from "@norish/shared-react/hooks";
import {
  createUseRecipesCacheHelpers,
  createUseRecipesMutations,
} from "@norish/shared-react/hooks/recipes/dashboard";

const useRecipesCacheHelpers = createUseRecipesCacheHelpers({ useTRPC });
const useSharedRecipesMutations = createUseRecipesMutations(
  { useTRPC },
  { useRecipesCacheHelpers }
);

export type { RecipesMutationsResult };

export function useRecipesMutations(): RecipesMutationsResult {
  const warmSet = useWarmSet();
  const router = useRouter();
  const tErrors = useTranslations("common.errors");
  const tQueued = useTranslations("common.queuedOffline");
  const tImport = useTranslations("recipes.import");

  // Importing a URL the household already holds is an answer, not a failure:
  // say so, and offer the recipe the import was reaching for.
  const showAlreadyExistsToast = (recipeId: string): void => {
    toast(tImport("alreadyExists"), {
      actionProps: {
        children: tImport("openExisting"),
        onPress: () => router.push(`/recipes/${recipeId}`),
      },
    });
  };

  const showMutationErrorToast = (error: unknown, operation: string): void => {
    // Backend-unreachable is the Queued outcome, not a failure: the Outbox has
    // captured the mutation (an import simply runs at Replay time), so tell the
    // user it's saved and will happen — never show an error toast for it.
    if (isQueuedForReplay(error)) {
      showQueuedOfflineToast({
        title: tQueued("title"),
        description: tQueued("description"),
      });

      return;
    }

    // Hitting the AI entitlement gate isn't a technical failure — tell the user
    // they're out of AI actions and point them at their plan.
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

    showSafeErrorToast({
      title: tErrors("operationFailed"),
      description: tErrors("technicalDetails"),
      color: "default",
      error,
      context: `recipes-mutations:${operation}`,
    });
  };

  return useSharedRecipesMutations(
    showMutationErrorToast,
    warmSet.promoteCreatedRecipe,
    showAlreadyExistsToast
  );
}
