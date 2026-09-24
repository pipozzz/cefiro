"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { ClockIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * A strip of dynamic "food themes" at the top of discovery. Phase A derives them
 * from the public-recipe corpus — the most-used tags (`social.trendingTopics`),
 * plus a handy "quick" filter — so the strip changes as the catalogue grows,
 * with no curation. Selecting a theme drives the existing discover filters.
 *
 * (Phase B will swap the source for semantic vector clusters — see the
 * discover-themes plan — behind this same UI/props.)
 */

// Emoji picked from a keyword in the tag, so tiles read at a glance. Matches
// Slovak and English stems; falls back to a generic plate.
function emojiForTag(name: string): string {
  const n = name.toLowerCase();
  const map: [string, string][] = [
    ["cestovin", "🍝"],
    ["pasta", "🍝"],
    ["špaget", "🍝"],
    ["šalát", "🥗"],
    ["salat", "🥗"],
    ["salad", "🥗"],
    ["polievk", "🍲"],
    ["soup", "🍲"],
    ["kur", "🍗"],
    ["chick", "🍗"],
    ["mäso", "🥩"],
    ["beef", "🥩"],
    ["bravč", "🥓"],
    ["ryb", "🐟"],
    ["fish", "🐟"],
    ["torta", "🍰"],
    ["koláč", "🍰"],
    ["kolac", "🍰"],
    ["cake", "🍰"],
    ["dezert", "🍰"],
    ["dessert", "🍰"],
    ["sladk", "🍰"],
    ["chlieb", "🍞"],
    ["bread", "🍞"],
    ["pizza", "🍕"],
    ["ryža", "🍚"],
    ["rice", "🍚"],
    ["vajc", "🥚"],
    ["egg", "🥚"],
    ["syr", "🧀"],
    ["cheese", "🧀"],
    ["zeleni", "🥦"],
    ["veget", "🥦"],
    ["raňaj", "🍳"],
    ["breakfast", "🍳"],
    ["nápoj", "🥤"],
    ["drink", "🥤"],
    ["ovoc", "🍓"],
    ["fruit", "🍓"],
  ];

  for (const [key, emoji] of map) {
    if (n.includes(key)) {
      return emoji;
    }
  }

  return "🍽️";
}

const tileClass = "flex w-[132px] shrink-0 flex-col gap-1 rounded-2xl p-3 text-left transition";

export function DiscoverThemes({
  onSelectTag,
  onQuick,
}: {
  onSelectTag: (tag: string) => void;
  onQuick: () => void;
}) {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");

  const { data } = useQuery({
    ...trpc.social.trendingTopics.queryOptions({ limit: 8 }),
    staleTime: 5 * 60_000,
  });

  const topics = data?.topics ?? [];

  // Nothing to explore yet (empty catalogue): render no strip at all.
  if (topics.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-foreground mb-3 text-sm font-semibold">{t("themesHeading")}</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <button
          className={`bg-accent-soft text-accent hover:opacity-90 ${tileClass}`}
          type="button"
          onClick={onQuick}
        >
          <ClockIcon className="h-6 w-6" />
          <span className="truncate text-sm font-semibold">{t("themeQuick")}</span>
        </button>

        {topics.map((topic) => (
          <button
            key={topic.name}
            className={`bg-content2 text-foreground hover:bg-content3 ${tileClass}`}
            type="button"
            onClick={() => onSelectTag(topic.name)}
          >
            <span className="text-2xl leading-none">{emojiForTag(topic.name)}</span>
            <span className="truncate text-sm font-medium">#{topic.name}</span>
            <span className="text-default-500 text-xs">
              {t("themeCount", { count: topic.recipeCount })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
