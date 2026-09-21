"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export function FollowButton({ handle }: { handle: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.follow");

  const statusQuery = useQuery({
    ...trpc.social.getFollowStatus.queryOptions({ handle }),
    retry: false,
  });

  const statusKey = trpc.social.getFollowStatus.queryKey({ handle });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: statusKey });
    queryClient.invalidateQueries({ queryKey: trpc.social.getProfile.queryKey({ handle }) });
  };

  // Optimistically flip the follow state so the button responds instantly;
  // roll back if the mutation fails, then reconcile with the server on settle.
  const optimisticToggle = (isFollowing: boolean) => async () => {
    await queryClient.cancelQueries({ queryKey: statusKey });
    const previous = queryClient.getQueryData(statusKey);

    queryClient.setQueryData(statusKey, (old) =>
      old ? { ...(old as Record<string, unknown>), isFollowing } : old
    );

    return { previous };
  };

  const followMutation = useMutation(
    trpc.social.follow.mutationOptions({
      onMutate: optimisticToggle(true),
      onError: (error, _vars, context) => {
        queryClient.setQueryData(statusKey, context?.previous);
        showSafeErrorToast(error, t("couldNotFollow"));
      },
      onSettled: invalidate,
    })
  );

  const unfollowMutation = useMutation(
    trpc.social.unfollow.mutationOptions({
      onMutate: optimisticToggle(false),
      onError: (error, _vars, context) => {
        queryClient.setQueryData(statusKey, context?.previous);
        showSafeErrorToast(error, t("couldNotUnfollow"));
      },
      onSettled: invalidate,
    })
  );

  // Anonymous viewers get UNAUTHORIZED from the authed status query — send them
  // to sign in, preserving the profile as the return destination.
  if (statusQuery.isError) {
    return (
      <Button as={Link} href={`/login?callbackUrl=/u/${handle}`} size="sm" variant="primary">
        {t("follow")}
      </Button>
    );
  }

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <Button isDisabled size="sm" variant="tertiary">
        …
      </Button>
    );
  }

  if (statusQuery.data.isSelf) {
    return (
      <Button as={Link} href="/profile" size="sm" variant="tertiary">
        {t("editProfile")}
      </Button>
    );
  }

  const following = statusQuery.data.isFollowing;
  const pending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <Button
      isPending={pending}
      size="sm"
      variant={following ? "tertiary" : "primary"}
      onPress={() =>
        following ? unfollowMutation.mutate({ handle }) : followMutation.mutate({ handle })
      }
    >
      {following ? t("following") : t("follow")}
    </Button>
  );
}
