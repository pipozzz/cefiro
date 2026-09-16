"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { SuggestedCooks } from "@/components/social/suggested-cooks";
import { Button, Spinner } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export default function FeedPage() {
  const trpc = useTRPC();
  const t = useTranslations("social.feed");

  const query = useInfiniteQuery({
    ...trpc.social.feed.infiniteQueryOptions(
      { limit: 24 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    ),
    retry: false,
  });

  const recipes = query.data?.pages.flatMap((page) => page.recipes) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-foreground text-2xl font-bold">{t("title")}</h1>
        <p className="text-default-500 text-sm">{t("subtitle")}</p>
      </header>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <div className="space-y-8">
          <div className="bg-content2 rounded-2xl p-10 text-center">
            <p className="text-default-600">{t("emptyTitle")}</p>
            <p className="text-default-500 mt-1 text-sm">{t("emptyBody")}</p>
            <Button as={Link} href="/discover" variant="primary" className="mt-4">
              {t("discoverCta")}
            </Button>
          </div>

          <SuggestedCooks />
        </div>
      ) : (
        <>
          <SocialRecipeGrid recipes={recipes} />

          {query.hasNextPage ? (
            <div className="mt-8 flex justify-center">
              <Button
                variant="tertiary"
                onPress={() => query.fetchNextPage()}
                isPending={query.isFetchingNextPage}
              >
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
