/**
 * Recipe Embedding Queue - Infrastructure
 *
 * Pure factory for creating the queue instance.
 * Callers own lifecycle (close on shutdown, via the registry).
 */

import { Queue } from "bullmq";

import type { RecipeEmbeddingJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { QUEUE_NAMES, recipeEmbeddingJobOptions } from "../config";

export function createRecipeEmbeddingQueue(
  removalOptions?: QueueRemovalOptions
): Queue<RecipeEmbeddingJobData> {
  return new Queue<RecipeEmbeddingJobData>(QUEUE_NAMES.RECIPE_EMBEDDING, {
    connection: getBullClient(),
    defaultJobOptions: { ...recipeEmbeddingJobOptions, ...removalOptions },
  });
}
