import { SERVER_CONFIG } from "@norish/config/env-config-server";

/**
 * Thin Voyage AI embeddings client. Voyage has no Vercel-AI-SDK provider, so
 * this is a direct fetch wrapper (mirrors the raw-client escape hatch the AI
 * runtime already uses for OpenAI). Powers semantic discovery themes (Phase B).
 *
 * Off by default: without VOYAGE_API_KEY, `isEmbeddingConfigured()` is false and
 * callers skip embedding rather than error.
 */

export function isEmbeddingConfigured(): boolean {
  return !!SERVER_CONFIG.VOYAGE_API_KEY;
}

export function embeddingModel(): string {
  return SERVER_CONFIG.VOYAGE_MODEL;
}

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

/**
 * Embed a batch of texts. `inputType` is "document" for stored recipes and
 * "query" for a search string (Voyage tunes the two differently). Returns one
 * vector per input, in input order. Throws when the key is missing or the API
 * errors — callers decide whether to swallow (background jobs) or surface it.
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  const key = SERVER_CONFIG.VOYAGE_API_KEY;

  if (!key) {
    throw new Error("VOYAGE_API_KEY is not set");
  }

  if (texts.length === 0) {
    return [];
  }

  const response = await fetch(SERVER_CONFIG.VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: SERVER_CONFIG.VOYAGE_MODEL,
      input_type: inputType,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(`Voyage embeddings failed: ${response.status} ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as VoyageResponse;

  // The API may return items out of order; sort by index to match `texts`.
  return json.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

/** Convenience for a single text. */
export async function embedText(
  text: string,
  inputType: "document" | "query" = "document"
): Promise<number[]> {
  const [vector] = await embedTexts([text], inputType);

  if (!vector) {
    throw new Error("Voyage returned no embedding");
  }

  return vector;
}
