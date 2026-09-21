"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { ShareLinkButton } from "@/components/social/share-link-button";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { RouterOutputs } from "@norish/trpc/client";

type PublicCookbookData = RouterOutputs["social"]["getPublicCookbook"];

export function PublicCookbookView({
  slug,
  initialData,
}: {
  slug: string;
  initialData?: PublicCookbookData;
}) {
  const trpc = useTRPC();
  const t = useTranslations("social.cookbook");

  const { data, isLoading, isError } = useQuery({
    ...trpc.social.getPublicCookbook.queryOptions({ slug }),
    initialData,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFoundTitle")} />;
  }

  const { title, description, owner, recipes } = data;
  const authorName = owner ? (owner.displayName ?? `@${owner.handle}`) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 md:px-6">
      <header className="pt-10">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">📚</p>
        <h1 className="text-foreground mt-1 text-3xl font-bold md:text-4xl">{title}</h1>
        {description ? <p className="text-default-600 mt-3 max-w-2xl">{description}</p> : null}

        <div className="text-default-500 mt-4 flex items-center gap-4 text-sm">
          <span>{t("recipesCount", { count: recipes.length })}</span>
          {owner && authorName ? (
            <Link
              className="hover:text-foreground inline-flex items-center gap-2"
              href={`/u/${owner.handle}`}
            >
              {owner.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-6 w-6 rounded-full object-cover" src={owner.avatarUrl} />
              ) : (
                <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold">
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <span>{authorName}</span>
            </Link>
          ) : null}
        </div>

        <div className="mt-4">
          <ShareLinkButton path={`/c/${slug}`} title={title} />
        </div>
      </header>

      <section className="mt-8">
        {recipes.length === 0 ? (
          <p className="bg-content2 text-default-500 rounded-2xl p-10 text-center">{t("empty")}</p>
        ) : (
          <SocialRecipeGrid recipes={recipes} />
        )}
      </section>
    </div>
  );
}
