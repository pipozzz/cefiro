"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/** Show the upgrade nudge once the reader is this close to (or out of) credits. */
const LOW_CREDITS_THRESHOLD = 3;

/**
 * A quiet "N left this month" line for the point where an AI action is about to
 * be spent (the import modals). It reuses the billing usage query and its
 * strings, and renders nothing on unmetered instances (self-hosted / unlimited)
 * so those users never see a limit that doesn't apply to them.
 *
 * As the reader nears the limit it also offers an upgrade link, turning the wall
 * into a conversion moment exactly where the limit is felt. The link only shows
 * on metered instances (billing on), so self-hosted users never see it.
 */
export function AiCreditsHint({ className }: { className?: string }) {
  const trpc = useTRPC();
  const t = useTranslations("settings");
  const { data } = useQuery({
    ...trpc.billing.getMyAiUsage.queryOptions(),
    staleTime: 60_000,
  });

  if (!data || data.unlimited || data.limit === null) {
    return null;
  }

  const remaining = Math.max(0, data.limit - data.used);
  const atLimit = remaining === 0;
  const showUpgrade = remaining <= LOW_CREDITS_THRESHOLD;

  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <p className="text-muted flex items-center gap-1 text-xs">
        <SparklesIcon className="h-3.5 w-3.5 shrink-0" />
        {atLimit ? t("billing.usage.atLimit") : t("billing.usage.remaining", { count: remaining })}
      </p>
      {showUpgrade ? (
        <Link
          className="text-primary text-xs font-medium hover:underline"
          href="/settings?tab=billing"
        >
          {t("billing.usage.upgradeCta")}
        </Link>
      ) : null}
    </div>
  );
}
