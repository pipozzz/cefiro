"use client";

import { useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { ChefHatIcon } from "./chef-hat-icon";

/**
 * The pending follow-requests inbox: shown to a private-profile owner so they
 * can accept or decline people who asked to follow them. Renders nothing when
 * there are no pending requests, so it's invisible for public accounts.
 */
export function FollowRequestsInbox() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("social.followRequests");

  const requestsKey = trpc.social.listFollowRequests.queryKey();

  const query = useQuery({
    ...trpc.social.listFollowRequests.queryOptions(),
    retry: false,
  });

  // Track which handle is mid-flight so its two buttons show a spinner.
  const [busy, setBusy] = useState<string | null>(null);

  const respond = useMutation(
    trpc.social.respondFollowRequest.mutationOptions({
      onError: (error) => showSafeErrorToast(error, t("couldNotRespond")),
      onSettled: (_data, _err, vars) => {
        setBusy(null);
        queryClient.invalidateQueries({ queryKey: requestsKey });
        queryClient.invalidateQueries({
          queryKey: trpc.social.followRequestCount.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.social.getFollowStatus.queryKey({ handle: vars.handle }),
        });
      },
    })
  );

  const requests = query.data?.requests ?? [];

  if (requests.length === 0) {
    return null;
  }

  const act = (handle: string, action: "accept" | "decline") => {
    setBusy(handle);
    respond.mutate({ handle, action });
  };

  return (
    <section className="mb-8">
      <h2 className="text-foreground mb-3 text-lg font-semibold">
        {t("title", { count: requests.length })}
      </h2>
      <ul className="flex flex-col gap-2">
        {requests.map((req) => {
          const name = req.displayName ?? `@${req.handle}`;
          const isBusy = busy === req.handle;

          return (
            <li
              key={req.handle}
              className="bg-content1 ring-default-100 flex items-center gap-3 rounded-2xl p-3 shadow-sm ring-1"
            >
              <Link className="flex min-w-0 flex-1 items-center gap-3" href={`/u/${req.handle}`}>
                {req.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                    src={req.avatarUrl}
                  />
                ) : (
                  <span className="bg-primary text-primary-foreground flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                    <ChefHatIcon className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="text-foreground block truncate font-semibold">{name}</span>
                  <span className="text-default-500 block truncate text-xs">
                    {t("requestedToFollow")}
                  </span>
                </span>
              </Link>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  isDisabled={isBusy}
                  isPending={isBusy}
                  size="sm"
                  variant="primary"
                  onPress={() => act(req.handle, "accept")}
                >
                  {t("accept")}
                </Button>
                <Button
                  isDisabled={isBusy}
                  size="sm"
                  variant="tertiary"
                  onPress={() => act(req.handle, "decline")}
                >
                  {t("decline")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
