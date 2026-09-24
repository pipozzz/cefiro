// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { buildRecipeEmbeddingText, embeddingContentHash } from "../../src/recipe-embedding/text";

const RECIPE = {
  name: "Cacio e Pepe",
  description: "A Roman classic.",
  cuisines: [{ name: "Italian" }],
  categories: ["Dinner"],
  tags: [{ name: "pasta" }],
  recipeIngredients: [{ ingredientName: "pecorino" }, { ingredientName: "black pepper" }],
} as unknown as FullRecipeDTO;

describe("buildRecipeEmbeddingText", () => {
  it("includes the name, description, cuisine, course, tags and ingredients", () => {
    const text = buildRecipeEmbeddingText(RECIPE);

    expect(text).toContain("Cacio e Pepe");
    expect(text).toContain("A Roman classic.");
    expect(text).toContain("Cuisine: Italian");
    expect(text).toContain("Course: Dinner");
    expect(text).toContain("Tags: pasta");
    expect(text).toContain("Ingredients: pecorino, black pepper");
  });

  it("omits empty sections rather than emitting bare labels", () => {
    const bare = buildRecipeEmbeddingText({
      ...RECIPE,
      description: null,
      cuisines: [],
      categories: [],
      tags: [],
      recipeIngredients: [],
    } as unknown as FullRecipeDTO);

    expect(bare).toBe("Cacio e Pepe");
  });
});

describe("embeddingContentHash", () => {
  it("is stable for the same model and text", () => {
    expect(embeddingContentHash("voyage-3", "hello")).toBe(
      embeddingContentHash("voyage-3", "hello")
    );
  });

  it("changes when the model changes, forcing a re-embed", () => {
    expect(embeddingContentHash("voyage-3", "hello")).not.toBe(
      embeddingContentHash("voyage-3.5", "hello")
    );
  });
});
