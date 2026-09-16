// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listDiscoverRecipes, searchPublicRecipes } from "@norish/db/repositories/follows";
import { listPublicRecipesByUserId } from "@norish/db/repositories/user-profiles";
import * as schema from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

/**
 * Public listing surfaces must resolve a recipe's thumbnail the same way the
 * authed app does: the first gallery image, with the legacy `recipes.image`
 * scalar only as a fallback. A recipe imported so its photo lands in the
 * gallery but not the scalar (e.g. a scraped recipe) previously showed a blank
 * placeholder on Discover while the owner saw the image in their library.
 */
describe("public recipe image resolution", () => {
  let cookId: string;
  const testBase = new RepositoryTestBase("test_public_recipe_images");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    cookId = user.id;

    const db = getTestDb();

    await db.insert(schema.userProfiles).values({ userId: cookId, handle: "cook", isPublic: true });
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function publicRecipeWithGalleryOnlyImage(galleryImage: string): Promise<string> {
    const db = getTestDb();
    // No scalar hero: the photo exists only as a gallery image.
    const recipe = await createTestRecipe(cookId, { image: null });

    await db
      .update(schema.recipes)
      .set({ visibility: "public", image: null })
      .where(eq(schema.recipes.id, recipe.id));

    await db
      .insert(schema.recipeImages)
      .values({ recipeId: recipe.id, image: galleryImage, order: "0" });

    return recipe.id;
  }

  it("Discover falls back to the first gallery image when the scalar is null", async () => {
    const image = "/recipes/abc/photo.jpg";
    const recipeId = await publicRecipeWithGalleryOnlyImage(image);

    const { items } = await listDiscoverRecipes({ sort: "newest", limit: 24 });
    const row = items.find((r) => r.id === recipeId);

    expect(row).toBeDefined();
    expect(row?.image).toBe(image);
  });

  it("Search falls back to the first gallery image when the scalar is null", async () => {
    const image = "/recipes/def/photo.jpg";
    const recipeId = await publicRecipeWithGalleryOnlyImage(image);

    const results = await searchPublicRecipes("Test Recipe", 24);
    const row = results.find((r) => r.id === recipeId);

    expect(row?.image).toBe(image);
  });

  it("A profile's recipe list falls back to the first gallery image", async () => {
    const image = "/recipes/ghi/photo.jpg";
    const recipeId = await publicRecipeWithGalleryOnlyImage(image);

    const { items } = await listPublicRecipesByUserId(cookId, 24);
    const row = items.find((r) => r.id === recipeId);

    expect(row?.image).toBe(image);
  });
});
