"use client";

import { useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { FlagIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type CommentsTranslator = ReturnType<typeof useTranslations<"social.comments">>;

function timeAgo(date: Date, t: CommentsTranslator): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.35, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];

  let value = seconds;
  let unit = "s";

  for (const [size, label] of units) {
    if (value < size) {
      unit = label;
      break;
    }

    value = Math.floor(value / size);
    unit = label;
  }

  return value <= 0 ? t("now") : t("ago", { value, unit });
}

export function CommentsSection({
  recipeId,
  slug,
  recipeAuthorHandle,
}: {
  recipeId: string;
  slug: string;
  recipeAuthorHandle?: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.comments");
  const [body, setBody] = useState("");

  const profileQuery = useQuery({
    ...trpc.social.getMyProfile.queryOptions(),
    retry: false,
  });

  const commentsQuery = useQuery({
    ...trpc.social.getComments.queryOptions({ recipeId, limit: 50 }),
    retry: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.social.getComments.queryKey({ recipeId }) });

  const postMutation = useMutation(
    trpc.social.postComment.mutationOptions({
      onSuccess: () => {
        setBody("");
        invalidate();
      },
      onError: (error) => showSafeErrorToast(error, t("couldNotPost")),
    })
  );

  const deleteMutation = useMutation(
    trpc.social.removeComment.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => showSafeErrorToast(error, t("couldNotDelete")),
    })
  );

  const reportMutation = useMutation(
    trpc.social.reportComment.mutationOptions({
      onSuccess: () => toast.success(t("reported")),
      onError: (error) => showSafeErrorToast(error, t("couldNotReport")),
    })
  );

  const isAnonymous = profileQuery.isError;
  const myProfile = profileQuery.data?.profile ?? null;
  const myHandle = myProfile?.handle ?? null;
  // The recipe owner can moderate (delete) any comment on their recipe.
  const isRecipeOwner = !!myHandle && !!recipeAuthorHandle && myHandle === recipeAuthorHandle;
  const comments = commentsQuery.data?.comments ?? [];

  return (
    <section className="mt-12">
      <h2 className="text-foreground mb-4 text-xl font-semibold">
        {t("heading")} {comments.length > 0 ? `(${comments.length})` : ""}
      </h2>

      {/* Composer */}
      {isAnonymous ? (
        <div className="bg-content2 text-default-600 mb-6 rounded-2xl p-4 text-sm">
          {t.rich("signInToJoin", {
            link: (chunks) => (
              <Link
                href={`/login?callbackUrl=/r/${slug}`}
                className="text-primary font-medium hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </div>
      ) : !profileQuery.isLoading && !myProfile ? (
        <div className="bg-content2 text-default-600 mb-6 rounded-2xl p-4 text-sm">
          {t.rich("createProfileToComment", {
            link: (chunks) => (
              <Link href="/profile" className="text-primary font-medium hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </div>
      ) : myProfile ? (
        <div className="mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("placeholder")}
            className="border-default-200 bg-content1 text-foreground focus:border-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              isDisabled={body.trim().length === 0}
              isPending={postMutation.isPending}
              onPress={() => postMutation.mutate({ recipeId, body: body.trim() })}
            >
              {t("post")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* List */}
      {commentsQuery.isLoading ? (
        <p className="text-default-500 text-sm">{t("loading")}</p>
      ) : comments.length === 0 ? (
        <p className="text-default-500 text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-5">
          {comments.map((comment) => {
            const name =
              comment.author?.displayName ??
              (comment.author ? `@${comment.author.handle}` : t("unknown"));
            const isOwnComment = !!myHandle && comment.author?.handle === myHandle;
            const canDelete = isOwnComment || isRecipeOwner;
            // Logged-in viewers can flag someone else's comment for review.
            const canReport = !!myProfile && !isOwnComment;

            return (
              <li key={comment.id} className="flex gap-3">
                {comment.author?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comment.author.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {comment.author ? (
                      <Link
                        href={`/u/${comment.author.handle}`}
                        className="text-foreground text-sm font-medium hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="text-foreground text-sm font-medium">{name}</span>
                    )}
                    <span className="text-default-400 text-xs">
                      {timeAgo(comment.createdAt, t)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {canReport ? (
                        <button
                          type="button"
                          aria-label={t("reportAria")}
                          title={t("report")}
                          className="text-default-400 hover:text-danger"
                          disabled={reportMutation.isPending}
                          onClick={() => reportMutation.mutate({ commentId: comment.id })}
                        >
                          <FlagIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          aria-label={t("deleteAria")}
                          className="text-default-400 hover:text-danger"
                          onClick={() => deleteMutation.mutate({ commentId: comment.id })}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-default-700 mt-0.5 text-sm whitespace-pre-line">
                    {comment.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
