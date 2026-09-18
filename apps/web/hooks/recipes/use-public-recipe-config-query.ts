"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_PUBLIC_RECIPE_CONFIG = {
  units: {},
  timersEnabled: true,
  timerKeywords: {
    enabled: true,
    hours: [],
    minutes: [],
    seconds: [],
    isOverridden: false,
  },
};

/**
 * Server-global rendering config for the public (discover) recipe view: unit
 * definitions and timer-keyword detection. Unlike the share-link config this
 * needs no token — a discovered recipe is public — so the cooking view on
 * `/r/[slug]` can read it directly.
 */
export function usePublicRecipeConfigQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.social.publicRecipeConfig.queryOptions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    units: data?.units ?? DEFAULT_PUBLIC_RECIPE_CONFIG.units,
    timersEnabled: data?.timersEnabled ?? DEFAULT_PUBLIC_RECIPE_CONFIG.timersEnabled,
    timerKeywords: data?.timerKeywords ?? DEFAULT_PUBLIC_RECIPE_CONFIG.timerKeywords,
    isLoading,
    error,
  };
}
