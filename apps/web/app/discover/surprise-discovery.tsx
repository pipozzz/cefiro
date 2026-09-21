"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * "Surprise me": a random handful of public recipes with a shuffle button.
 * Each fetch reshuffles server-side (ORDER BY random()), so refetching serves a
 * fresh set — a playful, low-effort way to stumble onto something new.
 */
export function SurpriseDiscovery() {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");

  const { data, isLoading, isFetching, refetch } = useQuery({
    ...trpc.social.surpriseRecipes.queryOptions({ limit: 9 }),
    // Always reshuffle on demand rather than serving the cached set.
    staleTime: 0,
    retry: false,
  });

  const recipes = data?.recipes ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-default-500 text-sm">{t("surpriseHint")}</p>
        <Button
          isPending={isFetching}
          startContent={<ArrowPathIcon className="h-4 w-4" />}
          variant="secondary"
          onPress={() => refetch()}
        >
          {t("surpriseShuffle")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">
          {t("noSurprise")}
        </p>
      ) : (
        <SocialRecipeGrid recipes={recipes} />
      )}
    </div>
  );
}
