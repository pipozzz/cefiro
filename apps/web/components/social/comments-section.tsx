"use client";

import { useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function timeAgo(date: Date): string {
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

  return value <= 0 ? "now" : `${value}${unit} ago`;
}

export function CommentsSection({ recipeId, slug }: { recipeId: string; slug: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
      onError: (error) => showSafeErrorToast(error, "Could not post comment"),
    })
  );

  const deleteMutation = useMutation(
    trpc.social.removeComment.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => showSafeErrorToast(error, "Could not delete comment"),
    })
  );

  const isAnonymous = profileQuery.isError;
  const myProfile = profileQuery.data?.profile ?? null;
  const myHandle = myProfile?.handle ?? null;
  const comments = commentsQuery.data?.comments ?? [];

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-semibold text-foreground">
        Comments {comments.length > 0 ? `(${comments.length})` : ""}
      </h2>

      {/* Composer */}
      {isAnonymous ? (
        <div className="mb-6 rounded-2xl bg-content2 p-4 text-sm text-default-600">
          <Link href={`/login?callbackUrl=/r/${slug}`} className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to join the conversation.
        </div>
      ) : !profileQuery.isLoading && !myProfile ? (
        <div className="mb-6 rounded-2xl bg-content2 p-4 text-sm text-default-600">
          <Link href="/profile" className="font-medium text-primary hover:underline">
            Create a public profile
          </Link>{" "}
          to comment.
        </div>
      ) : myProfile ? (
        <div className="mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Add a comment…"
            className="w-full rounded-xl border border-default-200 bg-content1 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              isDisabled={body.trim().length === 0}
              isPending={postMutation.isPending}
              onPress={() => postMutation.mutate({ recipeId, body: body.trim() })}
            >
              Post comment
            </Button>
          </div>
        </div>
      ) : null}

      {/* List */}
      {commentsQuery.isLoading ? (
        <p className="text-sm text-default-500">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-default-500">No comments yet. Be the first!</p>
      ) : (
        <ul className="space-y-5">
          {comments.map((comment) => {
            const name = comment.author?.displayName ?? (comment.author ? `@${comment.author.handle}` : "Unknown");
            const canDelete = myHandle && comment.author?.handle === myHandle;

            return (
              <li key={comment.id} className="flex gap-3">
                {comment.author?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={comment.author.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {comment.author ? (
                      <Link href={`/u/${comment.author.handle}`} className="text-sm font-medium text-foreground hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-foreground">{name}</span>
                    )}
                    <span className="text-xs text-default-400">{timeAgo(comment.createdAt)}</span>
                    {canDelete ? (
                      <button
                        type="button"
                        aria-label="Delete comment"
                        className="ml-auto text-default-400 hover:text-danger"
                        onClick={() => deleteMutation.mutate({ commentId: comment.id })}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-default-700">{comment.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
