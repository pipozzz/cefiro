"use client";

import { useEffect, useRef } from "react";
import useInView from "@/hooks/use-in-view";
import { Button, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Infinite scroll for the discovery grids: a sentinel that fetches the next page
 * as it scrolls into view, so the reader never has to reach for a button. The
 * button still renders as a fallback — for keyboard users, and if the observer
 * never fires — and turns into a spinner while a page is loading. Renders
 * nothing once there is nothing left to load.
 *
 * `rootMargin` fires the load ~600px before the sentinel is on screen, so the
 * next page is usually already there by the time the reader reaches the end.
 * The `isFetchingNextPage` guard plus TanStack Query's own de-duplication keep
 * a sentinel that stays in view from firing the same page twice.
 */
export function LoadMoreSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("social.discover");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "600px");

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      onLoadMore();
    }
  }, [inView, hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage) {
    return null;
  }

  return (
    <div ref={ref} className="mt-8 flex justify-center">
      {isFetchingNextPage ? (
        <Spinner />
      ) : (
        <Button variant="tertiary" onPress={onLoadMore}>
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
