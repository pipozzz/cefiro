"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { Button, toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/** Fork a public recipe into the viewer's own library, then open it. */
export function SaveRecipeButton({ recipeId, slug }: { recipeId: string; slug: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const t = useTranslations("social.save");

  const save = useMutation(
    trpc.social.saveRecipe.mutationOptions({
      onSuccess: (data) => {
        toast.success(t("saved"));
        router.push(`/recipes/${data.recipeId}`);
      },
      onError: (error) => {
        if (error.data?.code === "UNAUTHORIZED") {
          router.push(`/login?callbackUrl=/r/${slug}`);

          return;
        }

        showSafeErrorToast(error, t("couldNotSave"));
      },
    })
  );

  return (
    <Button
      variant="primary"
      size="sm"
      isPending={save.isPending}
      onPress={() => save.mutate({ recipeId })}
    >
      <BookmarkIcon className="h-4 w-4" />
      {t("cta")}
    </Button>
  );
}
