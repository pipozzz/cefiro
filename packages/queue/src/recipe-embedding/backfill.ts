/**
 * Backfill: enqueue an embedding job for every public recipe already on the
 * server, so semantic discovery has something to cluster before the first new
 * publish. The administrator's one-shot counterpart to the automatic schedule
 * that runs on publish/edit.
 *
 * Streamed by recipe-id cursor so a large catalogue never loads at once. Every
 * job is deduped and hash-skipped by the worker, so re-running the backfill is
 * cheap and safe.
 */

import { listPublicRecipeIds } from "@norish/db/repositories/recipe-embeddings";
import { createLogger } from "@norish/shared-server/logger";

import { getQueues } from "../registry";
import { addRecipeEmbeddingJob } from "./producer";

const log = createLogger("queue:recipe-embedding-backfill");

const PAGE_SIZE = 500;

export interface EmbeddingBackfillResult {
  /** How many public recipes had an embedding job enqueued. */
  queued: number;
}

export async function enrollEmbeddingForAllPublicRecipes(): Promise<EmbeddingBackfillResult> {
  const queue = getQueues().recipeEmbedding;
  let afterRecipeId: string | undefined;
  let queued = 0;

  for (;;) {
    const ids = await listPublicRecipeIds(PAGE_SIZE, afterRecipeId);

    if (ids.length === 0) break;

    for (const recipeId of ids) {
      await addRecipeEmbeddingJob(queue, recipeId);
      queued += 1;
    }

    if (ids.length < PAGE_SIZE) break;
    afterRecipeId = ids[ids.length - 1];
  }

  log.info({ queued }, "Recipe embedding backfill enqueued");

  return { queued };
}
