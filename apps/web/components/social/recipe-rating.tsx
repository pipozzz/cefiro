"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { StarsDisplay } from "./stars-display";

export function RecipeRating({
  recipeId,
  slug,
  initialAverage,
  initialCount,
}: {
  recipeId: string;
  slug: string;
  initialAverage: number | null;
  initialCount: number;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("social.rating");

  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [hover, setHover] = useState(0);

  const myRatingQuery = useQuery({
    ...trpc.social.getMyRecipeRating.queryOptions({ recipeId }),
    retry: false,
  });

  const setMutation = useMutation(
    trpc.social.setRecipeRating.mutationOptions({
      onSuccess: (data) => {
        setAverage(data.average);
        setCount(data.count);
        queryClient.setQueryData(trpc.social.getMyRecipeRating.queryKey({ recipeId }), () => ({
          recipeId,
          rating: data.rating,
        }));
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotSave")),
    })
  );

  const isAnonymous = myRatingQuery.isError;
  const myRating = myRatingQuery.data?.rating ?? 0;
  const pending = setMutation.isPending;

  const onPick = (n: number) => {
    if (isAnonymous) {
      router.push(`/login?callbackUrl=/r/${slug}`);

      return;
    }

    setMutation.mutate({ recipeId, rating: n });
  };

  const shown = hover || myRating;

  return (
    <div className="flex flex-col gap-1">
      {/* Average */}
      <div className="flex items-center gap-2">
        {average ? (
          <>
            <StarsDisplay value={average} size={18} />
            <span className="text-foreground text-sm font-medium">{average.toFixed(1)}</span>
            <span className="text-default-500 text-sm">({t("countLabel", { count })})</span>
          </>
        ) : (
          <span className="text-default-500 text-sm">{t("noRating")}</span>
        )}
      </div>

      {/* Interactive: your rating */}
      <div className="flex items-center gap-2">
        <span className="text-default-500 text-xs">
          {myRating ? t("yourRating") : t("ratePrompt")}
        </span>
        <span className="inline-flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              aria-label={t("starAria", { n })}
              onMouseEnter={() => setHover(n)}
              onClick={() => onPick(n)}
              className={`px-0.5 text-lg leading-none transition ${
                n <= shown ? "text-yellow-400" : "text-default-300 hover:text-yellow-300"
              }`}
            >
              ★
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
