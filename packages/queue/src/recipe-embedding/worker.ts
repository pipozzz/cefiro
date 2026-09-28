/**
 * Recipe Embedding Worker
 *
 * Keeps a public recipe's pgvector embedding in step with its content, and
 * drops the embedding when a recipe stops being public or is deleted. One
 * Voyage request per changed recipe; unchanged recipes are skipped by content
 * hash so a re-publish or an unrelated edit costs nothing.
 *
 * Uses the lazy worker pattern - starts on-demand and pauses when idle.
 */

import type { Job } from "bullmq";

import type { RecipeEmbeddingJobData } from "@norish/queue/contracts/job-types";
import {
  deleteRecipeEmbedding,
  getRecipeEmbeddingHash,
  upsertRecipeEmbedding,
} from "@norish/db/repositories/recipe-embeddings";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import {
  embeddingModel,
  embedText,
  isEmbeddingConfigured,
} from "@norish/shared-server/ai/embeddings/voyage";
import { createLogger } from "@norish/shared-server/logger";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { buildRecipeEmbeddingText, embeddingContentHash } from "./text";

const log = createLogger("worker:recipe-embedding");

export async function processRecipeEmbedding(job: Job<RecipeEmbeddingJobData>): Promise<void> {
  const { recipeId } = job.data;

  // Without a Voyage key there is nothing to compute. Leave any existing
  // embedding in place — the key may simply be temporarily unset — and skip.
  // Logged at WARN, not DEBUG: when an admin has just run the backfill, a whole
  // queue silently skipping (because VOYAGE_API_KEY is absent from the worker
  // process's env) is a misconfiguration worth surfacing, not routine noise.
  if (!isEmbeddingConfigured()) {
    log.warn(
      { recipeId },
      "Embeddings not configured (VOYAGE_API_KEY missing in the worker process); skipping"
    );

    return;
  }

  const recipe = await getRecipeFull(recipeId);

  // Deleted, or no longer public: it has no place in public discovery, so drop
  // whatever embedding it had. Idempotent when there was none.
  // Logged at INFO (not DEBUG) so a backfill that quietly skips is diagnosable
  // in production without flipping the log level: `exists`/`visibility` say
  // exactly why the worker declined a recipe an admin asked to embed.
  if (!recipe || recipe.visibility !== "public") {
    await deleteRecipeEmbedding(recipeId);
    log.info(
      { recipeId, exists: Boolean(recipe), visibility: recipe?.visibility ?? null },
      "Recipe embedding skipped: not found or not public"
    );

    return;
  }

  const model = embeddingModel();
  const text = buildRecipeEmbeddingText(recipe);
  const contentHash = embeddingContentHash(model, text);

  if ((await getRecipeEmbeddingHash(recipeId)) === contentHash) {
    log.info({ recipeId }, "Recipe embedding already up to date; skipped");

    return;
  }

  const embedding = await embedText(text, "document");

  await upsertRecipeEmbedding({ recipeId, embedding, model, contentHash });
  log.info({ recipeId, model }, "Recipe embedding stored");
}

const recipeEmbeddingWorker = defineLazyWorker<RecipeEmbeddingJobData>(
  QUEUE_NAMES.RECIPE_EMBEDDING,
  processRecipeEmbedding,
  (job, error) => {
    log.error(
      { jobId: job?.id, recipeId: job?.data.recipeId, err: error },
      "Recipe embedding failed"
    );
  }
);

export const startRecipeEmbeddingWorker = recipeEmbeddingWorker.start;
export const stopRecipeEmbeddingWorker = recipeEmbeddingWorker.stop;
