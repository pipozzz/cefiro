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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.social.getFollowStatus.queryKey({ handle }) });
    queryClient.invalidateQueries({ queryKey: trpc.social.getProfile.queryKey({ handle }) });
  };

  const followMutation = useMutation(
    trpc.social.follow.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => showSafeErrorToast(error, t("couldNotFollow")),
    })
  );

  const unfollowMutation = useMutation(
    trpc.social.unfollow.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => showSafeErrorToast(error, t("couldNotUnfollow")),
    })
  );

  // Anonymous viewers get UNAUTHORIZED from the authed status query — send them
  // to sign in, preserving the profile as the return destination.
  if (statusQuery.isError) {
    return (
      <Button as={Link} href={`/login?callbackUrl=/u/${handle}`} variant="primary" size="sm">
        {t("follow")}
      </Button>
    );
  }

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <Button variant="tertiary" size="sm" isDisabled>
        …
      </Button>
    );
  }

  if (statusQuery.data.isSelf) {
    return (
      <Button as={Link} href="/profile" variant="tertiary" size="sm">
        {t("editProfile")}
      </Button>
    );
  }

  const following = statusQuery.data.isFollowing;
  const pending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <Button
      variant={following ? "tertiary" : "primary"}
      size="sm"
      isPending={pending}
      onPress={() =>
        following ? unfollowMutation.mutate({ handle }) : followMutation.mutate({ handle })
      }
    >
      {following ? t("following") : t("follow")}
    </Button>
  );
}
