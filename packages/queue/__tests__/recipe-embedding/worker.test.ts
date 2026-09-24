// @vitest-environment node
/**
 * Recipe Embedding worker.
 *
 * The worker reconciles a recipe's discovery embedding from the recipe's live
 * state: it embeds a public recipe whose text changed, skips one whose text is
 * unchanged, and drops the embedding of anything that is missing or no longer
 * public. It never touches a database handle directly — the drizzle mock below
 * throws on any access — and it never embeds without a configured provider.
 */

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEmbeddingJobData } from "@norish/queue/contracts/job-types";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  getRecipeEmbeddingHash: vi.fn(),
  upsertRecipeEmbedding: vi.fn(),
  deleteRecipeEmbedding: vi.fn(),
  isEmbeddingConfigured: vi.fn(),
  embeddingModel: vi.fn(),
  embedText: vi.fn(),
}));

vi.mock("@norish/db/repositories/recipes", () => ({ getRecipeFull: mocks.getRecipeFull }));

vi.mock("@norish/db/drizzle", () => ({
  get db(): never {
    throw new Error("The worker must not hold a database handle");
  },
}));

vi.mock("@norish/db/repositories/recipe-embeddings", () => ({
  getRecipeEmbeddingHash: mocks.getRecipeEmbeddingHash,
  upsertRecipeEmbedding: mocks.upsertRecipeEmbedding,
  deleteRecipeEmbedding: mocks.deleteRecipeEmbedding,
}));

vi.mock("@norish/shared-server/ai/embeddings/voyage", () => ({
  isEmbeddingConfigured: mocks.isEmbeddingConfigured,
  embeddingModel: mocks.embeddingModel,
  embedText: mocks.embedText,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { processRecipeEmbedding } = await import("../../src/recipe-embedding/worker");

const PUBLIC_RECIPE = {
  id: "recipe-1",
  name: "Cacio e Pepe",
  description: "A Roman classic.",
  visibility: "public",
  recipeIngredients: [{ ingredientName: "pecorino" }, { ingredientName: "black pepper" }],
  cuisines: [{ id: "c1", name: "Italian" }],
  categories: ["Dinner"],
  tags: [{ name: "pasta" }],
};

function jobFor(recipeId = "recipe-1"): Job<RecipeEmbeddingJobData> {
  return { id: "job-1", data: { recipeId } } as Job<RecipeEmbeddingJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isEmbeddingConfigured.mockReturnValue(true);
  mocks.embeddingModel.mockReturnValue("voyage-3");
  mocks.getRecipeFull.mockResolvedValue(PUBLIC_RECIPE);
  mocks.getRecipeEmbeddingHash.mockResolvedValue(null);
  mocks.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("processRecipeEmbedding", () => {
  it("embeds a public recipe and stores the vector with its content hash", async () => {
    await processRecipeEmbedding(jobFor());

    expect(mocks.embedText).toHaveBeenCalledWith(
      expect.stringContaining("Cacio e Pepe"),
      "document"
    );
    expect(mocks.upsertRecipeEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: "recipe-1",
        embedding: [0.1, 0.2, 0.3],
        model: "voyage-3",
        contentHash: expect.any(String),
      })
    );
    expect(mocks.deleteRecipeEmbedding).not.toHaveBeenCalled();
  });

  it("skips embedding when the stored content hash already matches", async () => {
    // First run to learn the hash the worker computes for this recipe.
    await processRecipeEmbedding(jobFor());
    const storedHash = mocks.upsertRecipeEmbedding.mock.calls[0]?.[0].contentHash as string;

    vi.clearAllMocks();
    mocks.isEmbeddingConfigured.mockReturnValue(true);
    mocks.embeddingModel.mockReturnValue("voyage-3");
    mocks.getRecipeFull.mockResolvedValue(PUBLIC_RECIPE);
    mocks.getRecipeEmbeddingHash.mockResolvedValue(storedHash);

    await processRecipeEmbedding(jobFor());

    expect(mocks.embedText).not.toHaveBeenCalled();
    expect(mocks.upsertRecipeEmbedding).not.toHaveBeenCalled();
  });

  it("drops the embedding when the recipe is no longer public", async () => {
    mocks.getRecipeFull.mockResolvedValue({ ...PUBLIC_RECIPE, visibility: "private" });

    await processRecipeEmbedding(jobFor());

    expect(mocks.deleteRecipeEmbedding).toHaveBeenCalledWith("recipe-1");
    expect(mocks.embedText).not.toHaveBeenCalled();
    expect(mocks.upsertRecipeEmbedding).not.toHaveBeenCalled();
  });

  it("drops the embedding when the recipe no longer exists", async () => {
    mocks.getRecipeFull.mockResolvedValue(null);

    await processRecipeEmbedding(jobFor());

    expect(mocks.deleteRecipeEmbedding).toHaveBeenCalledWith("recipe-1");
    expect(mocks.embedText).not.toHaveBeenCalled();
  });

  it("does nothing when embeddings are not configured", async () => {
    mocks.isEmbeddingConfigured.mockReturnValue(false);

    await processRecipeEmbedding(jobFor());

    expect(mocks.getRecipeFull).not.toHaveBeenCalled();
    expect(mocks.embedText).not.toHaveBeenCalled();
    expect(mocks.deleteRecipeEmbedding).not.toHaveBeenCalled();
  });

  it("propagates a Voyage failure so BullMQ retries the job", async () => {
    mocks.embedText.mockRejectedValue(new Error("voyage timed out"));

    await expect(processRecipeEmbedding(jobFor())).rejects.toThrow("voyage timed out");
    expect(mocks.upsertRecipeEmbedding).not.toHaveBeenCalled();
  });
});
