/**
 * Name a discovery theme from a cluster's recipes (Phase B2).
 *
 * A self-contained model call, deliberately outside the administrator-editable
 * prompt system: theme naming is an internal, best-effort label, not a feature
 * an administrator tunes, and it must degrade to a derived label when AI is off
 * or the call fails. Mirrors the escape hatch `voyage.ts` uses for embeddings —
 * it reuses the configured provider and transport, nothing more.
 *
 * The label's language is left to the model: it is told to answer in the same
 * language as the titles, so a Slovak catalogue gets Slovak theme names with no
 * locale wiring.
 */

import { generateText, Output } from "ai";
import { z } from "zod";

import { getAIConfig } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import { createModelsFromConfig } from "../runtime/providers";

const ThemeNameSchema = z.object({
  name: z.string().min(1).max(40),
});

const SYSTEM =
  "You name collections of recipes with short, appetising food-theme labels, " +
  "like a menu section or a magazine feature.";

export interface ThemeNamingInput {
  /** Titles of recipes in the cluster, most representative first. */
  titles: string[];
  /** Common tags across the cluster, if any, as extra signal. */
  tags?: string[];
}

/**
 * A short theme name for the cluster, or null when naming is unavailable (AI
 * disabled) or fails — the caller then falls back to a derived label.
 */
export async function nameTheme(input: ThemeNamingInput): Promise<string | null> {
  if (input.titles.length === 0) return null;

  const config = await getAIConfig(true);

  if (!config?.enabled) return null;

  const titles = input.titles.slice(0, 12);
  const tagLine =
    input.tags && input.tags.length > 0 ? `\nCommon tags: ${input.tags.join(", ")}` : "";

  const prompt = [
    "These recipes were grouped together by similarity:",
    titles.map((title) => `- ${title}`).join("\n") + tagLine,
    "",
    "Give ONE short theme name for this group: 2–4 words, evocative but clear " +
      "(e.g. a menu section a diner would recognise). Answer in the SAME LANGUAGE " +
      "as the recipe titles above. Return only the name, no punctuation around it.",
  ].join("\n");

  try {
    const { model } = createModelsFromConfig(config, { structuredOutputs: true });
    const result = await generateText({
      model,
      output: Output.object({ schema: ThemeNameSchema }),
      system: SYSTEM,
      temperature: config.temperature,
      maxOutputTokens: 60,
      abortSignal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
      prompt,
    });

    const name = result.output.name.trim();

    return name === "" ? null : name;
  } catch (err) {
    // Naming is best-effort: a failure means a derived label, never a failed
    // clustering run.
    aiLogger.warn({ err }, "Theme naming failed; falling back to a derived label");

    return null;
  }
}
