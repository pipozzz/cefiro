"use client";

/**
 * Instruction renderer for the public discover recipe page (`/r/[slug]`).
 *
 * Like {@link PublicSmartInstruction}, but reads the tokenless public config
 * (a discovered recipe is public, so no share token is involved). It reads
 * only public config and never touches authenticated hooks or private context.
 */
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { usePublicRecipeConfigQuery } from "@/hooks/recipes/use-public-recipe-config-query";

interface PublicSlugSmartInstructionProps {
  text: string;
  recipeId: string;
  /** Present to satisfy the shared instruction-component contract; unused. */
  token?: string;
  recipeName?: string;
  stepIndex: number;
}

export function PublicSlugSmartInstruction({
  text,
  recipeId,
  recipeName,
  stepIndex,
}: PublicSlugSmartInstructionProps) {
  const { timersEnabled, timerKeywords } = usePublicRecipeConfigQuery();

  return (
    <SmartMarkdownRenderer
      linkMode="public"
      text={text}
      timerConfig={{
        enabled: timersEnabled && timerKeywords.enabled,
        keywords: {
          hours: timerKeywords.hours,
          minutes: timerKeywords.minutes,
          seconds: timerKeywords.seconds,
        },
        recipeId,
        recipeName,
        stepIndex,
      }}
    />
  );
}
