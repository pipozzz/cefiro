"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { FollowButton } from "./follow-button";

/**
 * Onboarding aid: public cooks the viewer doesn't follow yet, each with a
 * Follow button. Renders nothing when there are no suggestions, so it is safe
 * to drop into an empty-feed state.
 */
export function SuggestedCooks({ limit = 6 }: { limit?: number }) {
  const trpc = useTRPC();
  const t = useTranslations("social.suggestions");
  const tCard = useTranslations("social.profileCard");

  const { data, isLoading } = useQuery({
    ...trpc.social.suggestedCooks.queryOptions({ limit }),
    retry: false,
  });

  const cooks = data?.cooks ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (cooks.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{t("heading")}</h2>
      <p className="mb-4 text-sm text-default-500">{t("subtitle")}</p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cooks.map((cook) => {
          const name = cook.displayName ?? `@${cook.handle}`;

          return (
            <li
              key={cook.handle}
              className="flex items-center gap-3 rounded-2xl bg-content1 p-4 shadow-sm ring-1 ring-default-100"
            >
              <Link href={`/u/${cook.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                {cook.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cook.avatarUrl}
                    alt=""
                    className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{name}</span>
                  <span className="block truncate text-xs text-default-500">
                    {tCard("recipeCount", { count: cook.recipeCount })}
                  </span>
                </span>
              </Link>
              <FollowButton handle={cook.handle} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
