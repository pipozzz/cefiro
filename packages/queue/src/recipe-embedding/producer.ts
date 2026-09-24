import type { Queue } from "bullmq";

import type { RecipeEmbeddingJobData } from "@norish/queue/contracts/job-types";
import { createLogger } from "@norish/shared-server/logger";

import { getQueues } from "../registry";

const log = createLogger("queue:recipe-embedding");

/**
 * Jobs for the same recipe inside this window collapse to one. A publish is
 * usually followed by a flurry of small edits, and each would otherwise queue
 * its own embed; the window lets them settle into a single re-embed. The worker
 * still reads the latest recipe, so the collapsed job is never stale.
 */
const DEDUP_WINDOW_MS = 30_000;

function windowOf(now: number, spanMs: number): number {
  return Math.floor(now / spanMs);
}

/**
 * `:` is BullMQ's own separator for repeatable-job ids and it refuses a custom
 * id carrying it, so job-id parts are joined with `|`.
 */
export async function addRecipeEmbeddingJob(
  queue: Queue<RecipeEmbeddingJobData>,
  recipeId: string,
  now: number = Date.now()
): Promise<void> {
  await queue.add(
    "embed",
    { recipeId },
    { jobId: `embed|${recipeId}|${String(windowOf(now, DEDUP_WINDOW_MS))}` }
  );
}

/**
 * Fire-and-forget: schedule a recipe's discovery embedding to be recomputed
 * (or dropped). Safe on any recipe — the worker reconciles from the recipe's
 * current visibility, so a private recipe simply has its embedding removed.
 *
 * Every failure is swallowed. A recipe's discovery embedding is background
 * signal, never worth failing the publish or edit that triggered it, and never
 * worth a thrown "queue not initialized" reaching a request. Losing a schedule
 * costs one recipe its place in semantic discovery until it is next touched or
 * the admin backfill runs.
 */
export function scheduleRecipeEmbedding(recipeId: string): void {
  void (async () => {
    try {
      await addRecipeEmbeddingJob(getQueues().recipeEmbedding, recipeId);
    } catch (err) {
      log.error({ err, recipeId }, "Failed to schedule recipe embedding");
    }
  })();
}
