"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
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
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-default-500">{t("subtitle")}</p>
      </header>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-2xl bg-content2 p-10 text-center">
          <p className="text-default-600">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-default-500">{t("emptyBody")}</p>
          <Button as={Link} href="/discover" variant="primary" className="mt-4">
            {t("discoverCta")}
          </Button>
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
