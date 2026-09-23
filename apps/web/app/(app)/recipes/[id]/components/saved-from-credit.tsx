"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { BookmarkIcon } from "@heroicons/react/16/solid";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * "Saved from …" credit on a saved copy of a public recipe.
 *
 * Links to the original for as long as it stays publicly reachable; renders
 * nothing when this recipe is not a saved copy, or the source has since gone
 * private or been deleted — so the credit is never a dead link and never points
 * at a page that is no longer public. A private-profile author is credited
 * generically (a link to the recipe, no name), respecting their choice.
 */
export function SavedFromCredit({ recipeId }: { recipeId: string }) {
  const trpc = useTRPC();
  const t = useTranslations("social.save");
  const { data } = useQuery({
    ...trpc.social.getSavedFrom.queryOptions({ recipeId }),
    retry: false,
  });

  if (!data) {
    return null;
  }

  const author = data.authorName ?? (data.authorHandle ? `@${data.authorHandle}` : null);

  return (
    <Link
      className="text-muted hover:text-foreground bg-surface-secondary/60 hover:bg-surface-secondary inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition"
      href={`/r/${data.slug}`}
    >
      <BookmarkIcon className="h-3.5 w-3.5 shrink-0" />
      {author ? t("savedFromAuthor", { author }) : t("savedFromRecipe")}
    </Link>
  );
}

export default SavedFromCredit;
