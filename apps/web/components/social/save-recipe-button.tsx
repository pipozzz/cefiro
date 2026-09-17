"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { Button, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Save (fork) a public recipe into the viewer's own library.
 *
 * Three states, resolved from `getSaveState`:
 * - the recipe is the viewer's own → the button is not rendered (nothing to
 *   save; they already have it),
 * - they have already saved it → the button opens their existing copy instead
 *   of making a duplicate,
 * - otherwise → it forks the recipe (copying its image) and opens the copy.
 *
 * An anonymous viewer (the status query errors, as it is auth-only) is sent to
 * log in first, then returned here.
 */
export function SaveRecipeButton({ recipeId, slug }: { recipeId: string; slug: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("social.save");

  const stateQuery = useQuery({
    ...trpc.social.getSaveState.queryOptions({ recipeId }),
    retry: false,
  });

  const save = useMutation(
    trpc.social.saveRecipe.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.status === "existing" ? t("alreadySaved") : t("saved"));
        void queryClient.invalidateQueries({
          queryKey: trpc.social.getSaveState.queryKey({ recipeId }),
        });
        router.push(`/recipes/${data.recipeId}`);
      },
      onError: (error) => {
        if (error.data?.code === "UNAUTHORIZED") {
          router.push(`/login?callbackUrl=/r/${slug}`);

          return;
        }

        showSafeErrorToast({
          title: t("errorTitle"),
          description: t("couldNotSave"),
          error,
          context: "social.saveRecipe",
        });
      },
    })
  );

  const isAnonymous = stateQuery.isError;
  const isOwn = stateQuery.data?.isOwn ?? false;
  const savedRecipeId = stateQuery.data?.savedRecipeId ?? null;

  // Never offer to save your own recipe — it is already in your library.
  if (isOwn) {
    return null;
  }

  const onPress = () => {
    if (isAnonymous) {
      router.push(`/login?callbackUrl=/r/${slug}`);

      return;
    }

    // Already saved: just reopen the copy rather than forking again.
    if (savedRecipeId) {
      router.push(`/recipes/${savedRecipeId}`);

      return;
    }

    save.mutate({ recipeId });
  };

  return (
    <Button variant="primary" size="sm" isPending={save.isPending} onPress={onPress}>
      {savedRecipeId ? (
        <BookmarkSolidIcon className="h-4 w-4" />
      ) : (
        <BookmarkIcon className="h-4 w-4" />
      )}
      {savedRecipeId ? t("openCopy") : t("cta")}
    </Button>
  );
}
