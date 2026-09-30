// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  followUser,
  listDiscoverRecipes,
  listForYouRecipes,
  searchPublicRecipes,
} from "@norish/db/repositories/follows";
import { listPublicRecipeSlugs } from "@norish/db/repositories/user-profiles";
import * as schema from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("private profiles are not broadcast (v3)", () => {
  let viewerId: string;
  const testBase = new RepositoryTestBase("test_private_recipes_broadcast");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    viewerId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function createProfile(userId: string, handle: string, isPublic: boolean) {
    await getTestDb().insert(schema.userProfiles).values({ userId, handle, isPublic });
  }

  async function publicRecipe(userId: string, name: string): Promise<string> {
    const recipe = await createTestRecipe(userId, { name });
    await getTestDb()
      .update(schema.recipes)
      .set({ visibility: "public", slug: `${name}-slug` })
      .where(eq(schema.recipes.id, recipe.id));

    return recipe.id;
  }

  it("excludes a private cook's public recipe from discovery, search and the sitemap", async () => {
    const publicCook = await createTestUser();
    await createProfile(publicCook.id, "publiccook", true);
    await publicRecipe(publicCook.id, "shownrecipe");

    const privateCook = await createTestUser();
    await createProfile(privateCook.id, "privatecook", false);
    await publicRecipe(privateCook.id, "hiddenrecipe");

    const discover = (await listDiscoverRecipes({ sort: "newest", limit: 50 })).items.map(
      (r) => r.name
    );

    expect(discover).toContain("shownrecipe");
    expect(discover).not.toContain("hiddenrecipe");

    const search = (await searchPublicRecipes("recipe", 50)).map((r) => r.name);

    expect(search).toContain("shownrecipe");
    expect(search).not.toContain("hiddenrecipe");

    const slugs = (await listPublicRecipeSlugs()).map((r) => r.slug);

    expect(slugs).toContain("shownrecipe-slug");
    expect(slugs).not.toContain("hiddenrecipe-slug");
  });

  it("for-you hides a private cook's recipe from a non-follower but shows it to an approved follower", async () => {
    const privateCook = await createTestUser();
    await createProfile(privateCook.id, "privatecook", false);
    await publicRecipe(privateCook.id, "hiddenrecipe");

    // Non-follower: excluded.
    const before = (await listForYouRecipes({ userId: viewerId, limit: 50 })).items.map(
      (r) => r.name
    );

    expect(before).not.toContain("hiddenrecipe");

    // Approved follower: included again (they follow the private cook).
    await followUser(viewerId, privateCook.id, "accepted");

    const after = (await listForYouRecipes({ userId: viewerId, limit: 50 })).items.map(
      (r) => r.name
    );

    expect(after).toContain("hiddenrecipe");

    // A pending (unapproved) request does NOT unlock the broadcast tail.
    const other = await createTestUser();
    await createProfile(other.id, "otherprivate", false);
    await publicRecipe(other.id, "otherhidden");
    await followUser(viewerId, other.id, "pending");

    const stillHidden = (await listForYouRecipes({ userId: viewerId, limit: 50 })).items.map(
      (r) => r.name
    );

    expect(stillHidden).not.toContain("otherhidden");
  });
});
