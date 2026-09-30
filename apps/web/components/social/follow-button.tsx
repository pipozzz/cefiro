"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type FollowRelation = "none" | "pending" | "accepted";

export function FollowButton({ handle }: { handle: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("social.follow");

  const statusQuery = useQuery({
    ...trpc.social.getFollowStatus.queryOptions({ handle }),
    retry: false,
  });

  const statusKey = trpc.social.getFollowStatus.queryKey({ handle });

  const setRelation = (relation: FollowRelation) => {
    queryClient.setQueryData(statusKey, (old) =>
      old
        ? { ...(old as Record<string, unknown>), relation, isFollowing: relation === "accepted" }
        : old
    );
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: statusKey });
    queryClient.invalidateQueries({ queryKey: trpc.social.getProfile.queryKey({ handle }) });
  };

  const followMutation = useMutation(
    trpc.social.follow.mutationOptions({
      // The server decides accepted (public) vs pending (private); reflect its
      // answer, then reconcile the profile (recipe visibility can change).
      onSuccess: (result) => setRelation(result.relation as FollowRelation),
      onError: (error) => showSafeErrorToast(error, t("couldNotFollow")),
      onSettled: invalidate,
    })
  );

  const unfollowMutation = useMutation(
    trpc.social.unfollow.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: statusKey });
        const previous = queryClient.getQueryData(statusKey);

        setRelation("none");

        return { previous };
      },
      onError: (error, _vars, context) => {
        queryClient.setQueryData(statusKey, context?.previous);
        showSafeErrorToast(error, t("couldNotUnfollow"));
      },
      onSettled: invalidate,
    })
  );

  // Anonymous viewers (the public status query resolves with
  // isAuthenticated:false) — send them to sign in, preserving the profile as
  // the return destination. isError covers any real failure the same way.
  if (statusQuery.isError || (statusQuery.data && !statusQuery.data.isAuthenticated)) {
    return (
      <Button
        size="sm"
        variant="primary"
        onPress={() => router.push(`/login?callbackUrl=/u/${handle}`)}
      >
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
      <Button size="sm" variant="tertiary" onPress={() => router.push("/profile")}>
        {t("editProfile")}
      </Button>
    );
  }

  const relation = statusQuery.data.relation as FollowRelation;
  const pending = followMutation.isPending || unfollowMutation.isPending;

  // pending request → "Requested" (tap to cancel); accepted → "Following" (tap
  // to unfollow); none → "Follow".
  const label =
    relation === "pending"
      ? t("requested")
      : relation === "accepted"
        ? t("following")
        : t("follow");
  const active = relation !== "none";

  return (
    <Button
      isPending={pending}
      size="sm"
      variant={active ? "tertiary" : "primary"}
      onPress={() =>
        active ? unfollowMutation.mutate({ handle }) : followMutation.mutate({ handle })
      }
    >
      {label}
    </Button>
  );
}
