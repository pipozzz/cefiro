"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { Button, Spinner } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";

export default function FeedPage() {
  const trpc = useTRPC();

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
        <h1 className="text-2xl font-bold text-foreground">Your feed</h1>
        <p className="text-sm text-default-500">Latest recipes from people you follow.</p>
      </header>

      {query.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-2xl bg-content2 p-10 text-center">
          <p className="text-default-600">Your feed is empty.</p>
          <p className="mt-1 text-sm text-default-500">
            Follow some cooks to see their latest recipes here.
          </p>
          <Button as={Link} href="/discover" variant="primary" className="mt-4">
            Discover recipes
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
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
