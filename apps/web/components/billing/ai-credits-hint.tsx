"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * A quiet "N left this month" line for the point where an AI action is about to
 * be spent (the import modals). It reuses the billing usage query and its
 * strings, and renders nothing on unmetered instances (self-hosted / unlimited)
 * so those users never see a limit that doesn't apply to them.
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

  return (
    <p className={`text-muted flex items-center gap-1 text-xs ${className ?? ""}`}>
      <SparklesIcon className="h-3.5 w-3.5 shrink-0" />
      {atLimit ? t("billing.usage.atLimit") : t("billing.usage.remaining", { count: remaining })}
    </p>
  );
}
