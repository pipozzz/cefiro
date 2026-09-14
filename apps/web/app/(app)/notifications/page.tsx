"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function timeAgo(date: Date): string {
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

  return value <= 0 ? "now" : `${value}${unit} ago`;
}

type Notification = {
  id: string;
  type: "follow" | "like" | "comment";
  createdAt: Date;
  read: boolean;
  actor: { handle: string; displayName: string | null; avatarUrl: string | null } | null;
  recipe: { slug: string; name: string | null } | null;
};

function actionText(n: Notification): string {
  switch (n.type) {
    case "follow":
      return "started following you";
    case "like":
      return `liked your recipe ${n.recipe?.name ?? ""}`.trim();
    case "comment":
      return `commented on ${n.recipe?.name ?? "your recipe"}`;
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
  const markedRef = useRef(false);

  const query = useQuery({
    ...trpc.social.getNotifications.queryOptions({ limit: 50 }),
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

  const notifications = (query.data?.notifications ?? []) as Notification[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Notifications</h1>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : notifications.length === 0 ? (
        <p className="rounded-2xl bg-content2 p-10 text-center text-default-500">
          No notifications yet.
        </p>
      ) : (
        <ul className="divide-y divide-default-100 overflow-hidden rounded-2xl bg-content1 ring-1 ring-default-100">
          {notifications.map((n) => {
            const name = n.actor?.displayName ?? (n.actor ? `@${n.actor.handle}` : "Someone");

            return (
              <li key={n.id} className={n.read ? "" : "bg-primary/5"}>
                <Link href={href(n)} className="flex items-center gap-3 p-4 hover:bg-content2">
                  {n.actor?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.actor.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1 text-sm text-default-700">
                    <span className="font-medium text-foreground">{name}</span> {actionText(n)}
                  </span>
                  <span className="shrink-0 text-xs text-default-400">{timeAgo(n.createdAt)}</span>
                  {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
