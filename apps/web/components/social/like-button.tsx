"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export function LikeButton({
  recipeId,
  slug,
  initialCount,
}: {
  recipeId: string;
  slug: string;
  initialCount: number;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("social.like");
  const [count, setCount] = useState(initialCount);

  const statusQuery = useQuery({
    ...trpc.social.getLikeStatus.queryOptions({ recipeId }),
    retry: false,
  });

  const toggle = useMutation(
    trpc.social.toggleLike.mutationOptions({
      onSuccess: (data) => {
        setCount(data.favoriteCount);
        queryClient.setQueryData(trpc.social.getLikeStatus.queryKey({ recipeId }), () => ({
          recipeId,
          liked: data.liked,
        }));
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotUpdate")),
    })
  );

  const isAnonymous = statusQuery.isError;
  const liked = statusQuery.data?.liked ?? false;

  const onPress = () => {
    if (isAnonymous) {
      router.push(`/login?callbackUrl=/r/${slug}`);

      return;
    }

    // Optimistic count nudge; the mutation returns the authoritative value.
    setCount((c) => c + (liked ? -1 : 1));
    toggle.mutate({ recipeId, liked: !liked });
  };

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={toggle.isPending}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        liked
          ? "border-red-400/40 bg-red-500/10 text-red-500"
          : "border-default-200 bg-content1 text-default-600 hover:bg-content2"
      }`}
    >
      {liked ? (
        <HeartSolid className="h-5 w-5 text-red-500" />
      ) : (
        <HeartOutline className="h-5 w-5" />
      )}
      <span>{count}</span>
    </button>
  );
}
