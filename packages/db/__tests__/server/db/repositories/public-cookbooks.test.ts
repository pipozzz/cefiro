// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getCookbookPublishState,
  getPublicCookbookBySlug,
  listPublicCookbooksByUserId,
  setCookbookVisibility,
} from "@norish/db/repositories/public-cookbooks";
import * as schema from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

type Visibility = "private" | "unlisted" | "public";

describe("public cookbooks repository", () => {
  let ownerId: string;
  const testBase = new RepositoryTestBase("test_public_cookbooks");

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

  async function createCookbook(userId: string, visibility: Visibility = "private") {
    const db = getTestDb();
    const [cb] = await db
      .insert(schema.cookbooks)
      .values({ userId, title: "My Cookbook", visibility })
      .returning();

    return cb;
  }

  async function addRecipe(userId: string, visibility: Visibility, name: string) {
    const recipe = await createTestRecipe(userId, { name });
    const db = getTestDb();

    await db.update(schema.recipes).set({ visibility }).where(eq(schema.recipes.id, recipe.id));

    return recipe.id;
  }

  it("only the owner can change a cookbook's visibility", async () => {
    const cb = await createCookbook(ownerId);
    const stranger = await createTestUser();

    expect(await setCookbookVisibility(stranger.id, cb.id, "public")).toBeNull();

    const asOwner = await setCookbookVisibility(ownerId, cb.id, "public");

    expect(asOwner?.visibility).toBe("public");
    expect(asOwner?.slug).toBeTruthy();
  });

  it("assigns a slug on first publish and keeps it across re-privatise", async () => {
    const cb = await createCookbook(ownerId);
    const published = await setCookbookVisibility(ownerId, cb.id, "public");
    const slug = published?.slug;

    expect(slug).toBeTruthy();

    const reprivatised = await setCookbookVisibility(ownerId, cb.id, "private");

    expect(reprivatised?.slug).toBe(slug);

    const state = await getCookbookPublishState(ownerId, cb.id);

    expect(state?.visibility).toBe("private");
    expect(state?.slug).toBe(slug);
  });

  it("exposes only the PUBLIC recipes filed in a public cookbook", async () => {
    const cb = await createCookbook(ownerId, "public");
    const published = await setCookbookVisibility(ownerId, cb.id, "public");
    const publicRecipeId = await addRecipe(ownerId, "public", "Public one");
    const privateRecipeId = await addRecipe(ownerId, "private", "Private one");

    const db = getTestDb();

    await db.insert(schema.cookbookRecipes).values([
      { cookbookId: cb.id, recipeId: publicRecipeId },
      { cookbookId: cb.id, recipeId: privateRecipeId },
    ]);

    const result = await getPublicCookbookBySlug(published!.slug!);

    expect(result).not.toBeNull();

    const names = result!.recipes.map((r) => r.name);

    expect(names).toContain("Public one");
    expect(names).not.toContain("Private one");
  });

  it("hides a re-privatised cookbook from the public read and the profile", async () => {
    const cb = await createCookbook(ownerId);

    await setCookbookVisibility(ownerId, cb.id, "public");

    const slug = (await getCookbookPublishState(ownerId, cb.id))?.slug ?? "";

    expect(await getPublicCookbookBySlug(slug)).not.toBeNull();
    expect((await listPublicCookbooksByUserId(ownerId)).map((c) => c.slug)).toContain(slug);

    await setCookbookVisibility(ownerId, cb.id, "private");

    expect(await getPublicCookbookBySlug(slug)).toBeNull();
    expect((await listPublicCookbooksByUserId(ownerId)).map((c) => c.slug)).not.toContain(slug);
  });
});
