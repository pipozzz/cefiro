"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

/**
 * Clickable "trending topics" chips: the tags most-used across public recipes
 * (social.trendingTopics). Selecting one drives the discover tag filter, so the
 * reader jumps straight into a themed slice of the community. Renders nothing
 * until there is at least one topic, so an empty catalogue shows no header.
 */
export function TrendingTopics({
  activeTag,
  onSelect,
}: {
  activeTag: string | null;
  onSelect: (tag: string) => void;
}) {
  const trpc = useTRPC();
  const t = useTranslations("social.discover");

  const { data } = useQuery({
    ...trpc.social.trendingTopics.queryOptions({ limit: 12 }),
    retry: false,
  });

  const topics = data?.topics ?? [];

  if (topics.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-default-500 mb-3 text-xs font-semibold tracking-wide uppercase">
        {t("topicsHeading")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const active = activeTag?.toLowerCase() === topic.name.toLowerCase();

          return (
            <button
              key={topic.name}
              className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-3 text-sm font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-content2 text-default-600 hover:bg-content3"
              }`}
              type="button"
              onClick={() => onSelect(topic.name)}
            >
              #{topic.name}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-primary-foreground/20" : "bg-content3 text-default-500"
                }`}
              >
                {topic.recipeCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
