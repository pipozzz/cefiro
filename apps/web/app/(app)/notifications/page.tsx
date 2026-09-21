"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { FlagIcon } from "@heroicons/react/24/outline";
import { Button, Spinner } from "@heroui/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type NotificationsTranslator = ReturnType<typeof useTranslations<"social.notifications">>;

function timeAgo(date: Date, t: NotificationsTranslator): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const steps: [number, string][] = [
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

  for (const [size, label] of steps) {
    if (value < size) {
      unit = label;
      break;
    }

    value = Math.floor(value / size);
    unit = label;
  }

  return value <= 0 ? t("now") : t("ago", { value, unit });
}

type Notification = {
  id: string;
  type: "follow" | "like" | "comment" | "save" | "report";
  createdAt: Date;
  read: boolean;
  actor: { handle: string; displayName: string | null; avatarUrl: string | null } | null;
  recipe: { slug: string; name: string | null } | null;
};

function actionText(n: Notification, t: NotificationsTranslator): string {
  switch (n.type) {
    case "follow":
      return t("follow");
    case "like":
      return n.recipe?.name ? t("likeNamed", { name: n.recipe.name }) : t("like");
    case "comment":
      return n.recipe?.name ? t("commentNamed", { name: n.recipe.name }) : t("comment");
    case "save":
      return n.recipe?.name ? t("saveNamed", { name: n.recipe.name }) : t("save");
    // The reporter stays anonymous; the message stands on its own (see render).
    case "report":
      return t("report");
  }
}

function href(n: Notification): string {
  if (n.type === "follow") {
    return n.actor ? `/u/${n.actor.handle}` : "#";
  }

  return n.recipe ? `/r/${n.recipe.slug}` : "#";
}

export default function NotificationsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.notifications");
  const markedRef = useRef(false);

  const query = useInfiniteQuery({
    ...trpc.social.getNotifications.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    retry: false,
  });

  const markRead = useMutation(
    trpc.social.markNotificationsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.social.getUnreadNotificationCount.queryKey(),
        });
      },
    })
  );

  // Mark everything read once, after the list has loaded.
  useEffect(() => {
    if (!markedRef.current && query.isSuccess) {
      markedRef.current = true;
      markRead.mutate();
    }
  }, [query.isSuccess, markRead]);

  const notifications = (query.data?.pages.flatMap((page) => page.notifications) ??
    []) as Notification[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-foreground mb-6 text-2xl font-bold">{t("title")}</h1>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : notifications.length === 0 ? (
        <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">{t("empty")}</p>
      ) : (
        <ul className="divide-default-100 bg-content1 ring-default-100 divide-y overflow-hidden rounded-2xl ring-1">
          {notifications.map((n) => {
            const name = n.actor?.displayName ?? (n.actor ? `@${n.actor.handle}` : t("someone"));
            // A report keeps its reporter anonymous: a neutral flag, no name.
            const anonymous = n.type === "report";

            return (
              <li key={n.id} className={n.read ? "" : "bg-primary/5"}>
                <Link className="hover:bg-content2 flex items-center gap-3 p-4" href={href(n)}>
                  {anonymous ? (
                    <span className="bg-danger/15 text-danger flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                      <FlagIcon className="h-4 w-4" />
                    </span>
                  ) : n.actor?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                      src={n.actor.avatarUrl}
                    />
                  ) : (
                    <span className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-default-700 flex-1 text-sm">
                    {anonymous ? (
                      actionText(n, t)
                    ) : (
                      <>
                        <span className="text-foreground font-medium">{name}</span>{" "}
                        {actionText(n, t)}
                      </>
                    )}
                  </span>
                  <span className="text-default-400 shrink-0 text-xs">
                    {timeAgo(n.createdAt, t)}
                  </span>
                  {!n.read ? <span className="bg-primary h-2 w-2 shrink-0 rounded-full" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {query.hasNextPage ? (
        <div className="mt-6 flex justify-center">
          <Button
            isPending={query.isFetchingNextPage}
            variant="tertiary"
            onPress={() => query.fetchNextPage()}
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
