// @vitest-environment node
/**
 * `getSavedFromAttribution` powers the "Saved from …" credit on a saved copy.
 * It returns the source only while that source stays publicly reachable, keeps
 * the credit owner-scoped, and honours the source author's profile privacy.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createRecipeWithRefs,
  getSavedFromAttribution,
  setRecipeSavedFrom,
} from "@norish/db/repositories/recipes";
import { setRecipeVisibility, upsertProfile } from "@norish/db/repositories/user-profiles";

import { createTestUser } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("recipe_saved_from_attribution");

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

let handleSeq = 0;
function uniqueHandle(): string {
  handleSeq += 1;

  return `chef_${Date.now().toString(36)}_${handleSeq}`.toLowerCase().slice(0, 30);
}

/** A public recipe with a slug, owned by an author with a public profile. */
async function makePublishedSource(
  authorId: string,
  name: string,
  opts: { profilePublic?: boolean; displayName?: string | null } = {}
): Promise<{ recipeId: string; slug: string; handle: string }> {
  const handle = uniqueHandle();

  await upsertProfile(authorId, {
    handle,
    displayName: opts.displayName ?? null,
    isPublic: opts.profilePublic ?? true,
  });

  const recipeId = await makeRecipe(authorId, name);
  const published = await setRecipeVisibility(authorId, recipeId, "public");

  if (!published?.slug) {
    throw new Error("expected a slug after publishing");
  }

  return { recipeId, slug: published.slug, handle };
}

describe("getSavedFromAttribution", () => {
  it("returns null for a recipe that was not saved from anything", async () => {
    const owner = await createTestUser();
    const plain = await makeRecipe(owner.id, "Vlastný recept");

    expect(await getSavedFromAttribution(plain, owner.id)).toBeNull();
  });

  it("credits the source and its public author", async () => {
    const author = await createTestUser();
    const saver = await createTestUser();

    const source = await makePublishedSource(author.id, "Guláš", {
      displayName: "Chef Jano",
    });
    const copy = await makeRecipe(saver.id, "Guláš");
    await setRecipeSavedFrom(copy, source.recipeId);

    expect(await getSavedFromAttribution(copy, saver.id)).toEqual({
      slug: source.slug,
      authorHandle: source.handle,
      authorName: "Chef Jano",
    });
  });

  it("only the owner of the copy can read its provenance", async () => {
    const author = await createTestUser();
    const saver = await createTestUser();
    const stranger = await createTestUser();

    const source = await makePublishedSource(author.id, "Halušky");
    const copy = await makeRecipe(saver.id, "Halušky");
    await setRecipeSavedFrom(copy, source.recipeId);

    expect(await getSavedFromAttribution(copy, stranger.id)).toBeNull();
  });

  it("drops the credit when the source is no longer public", async () => {
    const author = await createTestUser();
    const saver = await createTestUser();

    const source = await makePublishedSource(author.id, "Kapustnica");
    const copy = await makeRecipe(saver.id, "Kapustnica");
    await setRecipeSavedFrom(copy, source.recipeId);

    // Author takes the original back to private — the credit must disappear.
    await setRecipeVisibility(author.id, source.recipeId, "private");

    expect(await getSavedFromAttribution(copy, saver.id)).toBeNull();
  });

  it("keeps the link but hides the name for a private-profile author", async () => {
    const author = await createTestUser();
    const saver = await createTestUser();

    const source = await makePublishedSource(author.id, "Lokše", {
      profilePublic: false,
      displayName: "Hidden Chef",
    });
    const copy = await makeRecipe(saver.id, "Lokše");
    await setRecipeSavedFrom(copy, source.recipeId);

    expect(await getSavedFromAttribution(copy, saver.id)).toEqual({
      slug: source.slug,
      authorHandle: null,
      authorName: null,
    });
  });
});
