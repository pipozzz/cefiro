"use client";

import { memo } from "react";
import { SpoonLoader } from "@/components/shared/spoon-loader";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

type PendingRecipeCardProps = {
  variant?: "grid" | "list";
};

/**
 * Placeholder card for a recipe still importing (e.g. from a URL). Matches the
 * recipe-card footprint so the grid doesn't reflow when the real card arrives,
 * and shows the stirring-spoon loader with an "importing" label instead of a
 * plain skeleton — a small bit of kitchen character while we cook the recipe up.
 */
function PendingRecipeCardComponent({ variant = "grid" }: PendingRecipeCardProps) {
  const t = useTranslations("common.import.url");
  const label = t("importing");

  if (variant === "list") {
    return (
      <Card
        data-recipe-card
        className="text-accent h-[128px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl p-0"
      >
        <div className="flex h-full w-full items-center gap-3 px-4">
          <SpoonLoader label={label} size={48} />
          <span className="text-default-500 text-sm font-medium">{label}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-recipe-card
      className="text-accent h-[340px] w-full items-center justify-center gap-4 overflow-hidden rounded-3xl p-0"
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <SpoonLoader label={label} size={84} />
        <span className="text-default-500 text-sm font-medium">{label}</span>
      </div>
    </Card>
  );
}

const PendingRecipeCard = memo(PendingRecipeCardComponent);

PendingRecipeCard.displayName = "PendingRecipeCard";

export default PendingRecipeCard;
