"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
      onError: (error) => showSafeErrorToast(error, "Could not save your rating"),
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
            <span className="text-sm font-medium text-foreground">{average.toFixed(1)}</span>
            <span className="text-sm text-default-500">
              ({count} {count === 1 ? "hodnotenie" : count >= 2 && count <= 4 ? "hodnotenia" : "hodnotení"})
            </span>
          </>
        ) : (
          <span className="text-sm text-default-500">Zatiaľ bez hodnotenia</span>
        )}
      </div>

      {/* Interactive: your rating */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-default-500">
          {myRating ? "Tvoje hodnotenie:" : "Ohodnoť recept:"}
        </span>
        <span className="inline-flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              aria-label={`${n} z 5`}
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
