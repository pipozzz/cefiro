"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { ClockIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * A strip of dynamic "food themes" at the top of discovery.
 *
 * Two sources, same strip (`social.discoverThemes` decides which):
 * - Semantic clusters (Phase B): each tile carries a `themeId`; selecting it
 *   runs a vector-similarity search via `onSelectTheme`.
 * - Tag fallback (Phase A) before any clusters exist: each tile carries a `tag`;
 *   selecting it drives the existing tag filter via `onSelectTag`.
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
  onSelectTheme,
  onQuick,
}: {
  onSelectTag: (tag: string) => void;
  onSelectTheme: (theme: { id: string; name: string }) => void;
  onQuick: () => void;
}) {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");

  const { data, isLoading } = useQuery({
    ...trpc.social.discoverThemes.queryOptions({ limit: 8 }),
    staleTime: 5 * 60_000,
  });

  const themes = data?.themes ?? [];

  // Reserve the strip's space while loading so the page below doesn't jump when
  // the tiles arrive.
  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-foreground mb-3 text-sm font-semibold">{t("themesHeading")}</h2>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              className={`${tileClass} bg-content2 h-[128px] animate-pulse`}
            />
          ))}
        </div>
      </div>
    );
  }

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
            key={theme.themeId ?? theme.tag ?? theme.name}
            className={`${tileClass} bg-content2 hover:bg-content3`}
            type="button"
            onClick={() =>
              theme.themeId
                ? onSelectTheme({ id: theme.themeId, name: theme.name })
                : onSelectTag(theme.tag ?? theme.name)
            }
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
                {theme.themeId ? theme.name : `#${theme.name}`}
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
