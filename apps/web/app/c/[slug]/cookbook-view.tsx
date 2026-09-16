"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { NotFoundView } from "@/components/shared/not-found-view";
import { SocialRecipeGrid } from "@/components/social/social-recipe-card";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export function PublicCookbookView({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const t = useTranslations("social.cookbook");

  const { data, isLoading, isError } = useQuery({
    ...trpc.social.getPublicCookbook.queryOptions({ slug }),
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
    return <NotFoundView title={t("notFoundTitle")} message={t("notFoundMessage")} />;
  }

  const { title, description, owner, recipes } = data;
  const authorName = owner ? (owner.displayName ?? `@${owner.handle}`) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      <header className="pt-10">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">📚</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-default-600">{description}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-4 text-sm text-default-500">
          <span>{t("recipesCount", { count: recipes.length })}</span>
          {owner && authorName ? (
            <Link
              href={`/u/${owner.handle}`}
              className="inline-flex items-center gap-2 hover:text-foreground"
            >
              {owner.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={owner.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <span>{authorName}</span>
            </Link>
          ) : null}
        </div>
      </header>

      <section className="mt-8">
        {recipes.length === 0 ? (
          <p className="rounded-2xl bg-content2 p-10 text-center text-default-500">{t("empty")}</p>
        ) : (
          <SocialRecipeGrid recipes={recipes} />
        )}
      </section>
    </div>
  );
}
