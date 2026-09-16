"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { CookGrid } from "./cook-card";

/**
 * Onboarding aid: public cooks the viewer doesn't follow yet, each with a
 * Follow button. Renders nothing when there are no suggestions, so it is safe
 * to drop into an empty-feed state.
 */
export function SuggestedCooks({ limit = 6 }: { limit?: number }) {
  const trpc = useTRPC();
  const t = useTranslations("social.suggestions");

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
      <h2 className="text-foreground text-lg font-semibold">{t("heading")}</h2>
      <p className="text-default-500 mb-4 text-sm">{t("subtitle")}</p>

      <CookGrid cooks={cooks} />
    </section>
  );
}
