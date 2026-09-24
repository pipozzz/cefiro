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

const tileClass = "w-[150px] shrink-0 overflow-hidden rounded-2xl text-left transition";

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
    ...trpc.social.discoverThemes.queryOptions({ limit: 8 }),
    staleTime: 5 * 60_000,
  });

  const themes = data?.themes ?? [];

  // Nothing to explore yet (empty catalogue): render no strip at all.
  if (themes.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-foreground mb-3 text-sm font-semibold">{t("themesHeading")}</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <button
          className={`${tileClass} bg-accent-soft hover:opacity-90`}
          type="button"
          onClick={onQuick}
        >
          <div className="text-accent flex h-[84px] w-full items-center justify-center">
            <ClockIcon className="h-9 w-9" />
          </div>
          <div className="p-2.5">
            <span className="text-accent block truncate text-sm font-semibold">
              {t("themeQuick")}
            </span>
          </div>
        </button>

        {themes.map((theme) => (
          <button
            key={theme.name}
            className={`${tileClass} bg-content2 hover:bg-content3`}
            type="button"
            onClick={() => onSelectTag(theme.name)}
          >
            <div className="bg-content3 relative h-[84px] w-full">
              {theme.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={theme.image}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl">
                  {emojiForTag(theme.name)}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <span className="text-foreground block truncate text-sm font-medium">
                #{theme.name}
              </span>
              <span className="text-default-500 text-xs">
                {t("themeCount", { count: theme.recipeCount })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
