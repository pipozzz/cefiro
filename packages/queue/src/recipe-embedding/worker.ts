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
  if (!isEmbeddingConfigured()) {
    log.debug({ recipeId }, "Embeddings not configured; skipping");

    return;
  }

  const recipe = await getRecipeFull(recipeId);

  // Deleted, or no longer public: it has no place in public discovery, so drop
  // whatever embedding it had. Idempotent when there was none.
  if (!recipe || recipe.visibility !== "public") {
    await deleteRecipeEmbedding(recipeId);
    log.debug({ recipeId, exists: Boolean(recipe) }, "Recipe not public; embedding removed");

    return;
  }

  const model = embeddingModel();
  const text = buildRecipeEmbeddingText(recipe);
  const contentHash = embeddingContentHash(model, text);

  if ((await getRecipeEmbeddingHash(recipeId)) === contentHash) {
    log.debug({ recipeId }, "Recipe embedding already up to date");

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
