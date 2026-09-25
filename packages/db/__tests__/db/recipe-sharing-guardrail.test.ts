// @vitest-environment node
/**
 * The copyright guardrail for the bulk sharing manager: a recipe imported from an
 * external source (its `url` is set) is flagged `imported` and must be excluded
 * when bulk-publishing, so external content is never broadcast to discovery in a
 * sweep. `listOwnRecipesForSharing` surfaces the flag; `getImportedRecipeIds`
 * resolves which of a set of ids are the caller's imported recipes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createRecipeWithRefs,
  getImportedRecipeIds,
  listOwnRecipesForSharing,
} from "@norish/db/repositories/recipes";

import { createTestUser } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("recipe_sharing_guardrail");

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => await testBase.beforeEachTest());

const BASE_RECIPE = {
  systemUsed: "metric" as const,
  recipeIngredients: [],
  tags: [],
  cuisines: [],
  categories: [],
  steps: [],
  images: [],
  videos: [],
};

async function makeRecipe(ownerId: string, name: string, url?: string): Promise<string> {
  const id = crypto.randomUUID();

  await createRecipeWithRefs(id, ownerId, { ...BASE_RECIPE, name, url });

  return id;
}

describe("listOwnRecipesForSharing — imported flag", () => {
  it("flags a recipe with a source URL as imported, and an authored one as not", async () => {
    const user = await createTestUser();

    const own = await makeRecipe(user.id, "Vlastný recept");
    const imported = await makeRecipe(user.id, "Importovaný recept", "https://example.com/recipe");

    const rows = await listOwnRecipesForSharing(user.id);
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(own)?.imported).toBe(false);
    expect(byId.get(imported)?.imported).toBe(true);
  });
});

describe("getImportedRecipeIds", () => {
  it("returns only the caller's imported ids from a set", async () => {
    const user = await createTestUser();

    const own = await makeRecipe(user.id, "Domáci koláč");
    const imported = await makeRecipe(user.id, "Cudzí koláč", "https://example.com/cake");

    const result = await getImportedRecipeIds(user.id, [own, imported]);

    expect(result.has(imported)).toBe(true);
    expect(result.has(own)).toBe(false);
    expect(result.size).toBe(1);
  });

  it("never returns another user's imported recipe", async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();

    const bobImported = await makeRecipe(bob.id, "Bobov recept", "https://example.com/bob");

    // Alice asks about Bob's imported id — it is not hers, so it is not returned.
    const result = await getImportedRecipeIds(alice.id, [bobImported]);

    expect(result.size).toBe(0);
  });

  it("returns an empty set for no ids", async () => {
    const user = await createTestUser();

    expect((await getImportedRecipeIds(user.id, [])).size).toBe(0);
  });
});
