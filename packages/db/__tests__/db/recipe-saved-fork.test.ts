// @vitest-environment node
/**
 * The provenance link that powers "save" (fork) dedupe: `setRecipeSavedFrom`
 * stamps a copy with the id of the recipe it was saved from, and
 * `getSavedForkForUser` finds that copy again so a repeat save reopens it
 * instead of piling up duplicates. The link is per-user and per-source.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createRecipeWithRefs,
  getSavedForkForUser,
  setRecipeSavedFrom,
} from "@norish/db/repositories/recipes";

import { createTestUser } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("recipe_saved_fork");

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

async function makeRecipe(ownerId: string, name: string): Promise<string> {
  const id = crypto.randomUUID();

  await createRecipeWithRefs(id, ownerId, { ...BASE_RECIPE, name });

  return id;
}

describe("saved-fork provenance", () => {
  it("finds a user's copy of a source after it is stamped", async () => {
    const author = await createTestUser();
    const saver = await createTestUser();

    const source = await makeRecipe(author.id, "Segedínsky guláš");
    const fork = await makeRecipe(saver.id, "Segedínsky guláš");

    // Before stamping, nothing links the two.
    expect(await getSavedForkForUser(saver.id, source)).toBeNull();

    await setRecipeSavedFrom(fork, source);

    const found = await getSavedForkForUser(saver.id, source);

    expect(found?.recipeId).toBe(fork);
  });

  it("scopes the lookup to the asking user", async () => {
    const author = await createTestUser();
    const alice = await createTestUser();
    const bob = await createTestUser();

    const source = await makeRecipe(author.id, "Bryndzové halušky");
    const aliceFork = await makeRecipe(alice.id, "Bryndzové halušky");
    const bobFork = await makeRecipe(bob.id, "Bryndzové halušky");

    await setRecipeSavedFrom(aliceFork, source);
    await setRecipeSavedFrom(bobFork, source);

    // Each saver only sees their own copy; the author (who never saved it) sees
    // none.
    expect((await getSavedForkForUser(alice.id, source))?.recipeId).toBe(aliceFork);
    expect((await getSavedForkForUser(bob.id, source))?.recipeId).toBe(bobFork);
    expect(await getSavedForkForUser(author.id, source)).toBeNull();
  });

  it("returns null for a source the user has not saved", async () => {
    const saver = await createTestUser();
    const author = await createTestUser();

    const source = await makeRecipe(author.id, "Kapustnica");
    const unrelated = await makeRecipe(author.id, "Lokše");
    const fork = await makeRecipe(saver.id, "Kapustnica");

    await setRecipeSavedFrom(fork, source);

    // A different source the saver never forked resolves to nothing.
    expect(await getSavedForkForUser(saver.id, unrelated)).toBeNull();
  });
});
