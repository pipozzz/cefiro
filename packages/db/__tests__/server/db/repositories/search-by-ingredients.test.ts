// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { searchPublicRecipesByIngredients } from "@norish/db/repositories/follows";
import * as schema from "@norish/db/schema";

import {
  createTestIngredient,
  createTestRecipe,
  createTestRecipeIngredients,
  createTestUser,
  getTestDb,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("searchPublicRecipesByIngredients — diacritics", () => {
  let ownerId: string;
  const testBase = new RepositoryTestBase("test_search_by_ingredients");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    ownerId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function publicRecipeWithIngredient(name: string, ingredientName: string): Promise<void> {
    const recipe = await createTestRecipe(ownerId, { name });
    await getTestDb()
      .update(schema.recipes)
      .set({ visibility: "public", slug: `${name}-slug` })
      .where(eq(schema.recipes.id, recipe.id));

    const ingredient = await createTestIngredient({ name: ingredientName });
    await createTestRecipeIngredients(recipe.id, ingredient.id, "metric");
  }

  it("matches regardless of diacritics (ryza ↔ ryža)", async () => {
    await publicRecipeWithIngredient("Rizoto", "ryža");

    // Accent-free query finds the accented ingredient.
    expect((await searchPublicRecipesByIngredients(["ryza"], 10)).map((r) => r.name)).toContain(
      "Rizoto"
    );
    // Accented query still works.
    expect((await searchPublicRecipesByIngredients(["ryža"], 10)).map((r) => r.name)).toContain(
      "Rizoto"
    );
    // Uppercase / case-insensitive too.
    expect((await searchPublicRecipesByIngredients(["RYZA"], 10)).map((r) => r.name)).toContain(
      "Rizoto"
    );
  });

  it("does not match an unrelated ingredient", async () => {
    await publicRecipeWithIngredient("Rizoto", "ryža");

    expect(
      (await searchPublicRecipesByIngredients(["cukor"], 10)).map((r) => r.name)
    ).not.toContain("Rizoto");
  });
});
