// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { followUser } from "@norish/db/repositories/follows";
import { listSuggestedProfiles, searchPublicProfiles } from "@norish/db/repositories/user-profiles";
import * as schema from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("social profile discovery", () => {
  let viewerId: string;
  const testBase = new RepositoryTestBase("test_social_profiles");

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

  async function createProfile(
    userId: string,
    handle: string,
    opts: { isPublic?: boolean; displayName?: string | null; bio?: string | null } = {}
  ) {
    const db = getTestDb();

    await db.insert(schema.userProfiles).values({
      userId,
      handle,
      isPublic: opts.isPublic ?? true,
      displayName: opts.displayName ?? null,
      bio: opts.bio ?? null,
    });
  }

  async function givePublicRecipe(userId: string) {
    const recipe = await createTestRecipe(userId, {});
    const db = getTestDb();

    await db
      .update(schema.recipes)
      .set({ visibility: "public" })
      .where(eq(schema.recipes.id, recipe.id));
  }

  it("suggests public cooks with recipes that the viewer doesn't already follow", async () => {
    await createProfile(viewerId, "viewer");

    const cookA = await createTestUser();
    await createProfile(cookA.id, "cooka");
    await givePublicRecipe(cookA.id);

    const cookB = await createTestUser();
    await createProfile(cookB.id, "cookb");
    await givePublicRecipe(cookB.id);

    const noRecipes = await createTestUser();
    await createProfile(noRecipes.id, "norecipes"); // public, but no public recipe

    await followUser(viewerId, cookB.id); // already following cookB

    const suggestions = (await listSuggestedProfiles(viewerId, 10)).map((p) => p.handle);

    expect(suggestions).toContain("cooka"); // eligible
    expect(suggestions).not.toContain("cookb"); // already followed
    expect(suggestions).not.toContain("viewer"); // never suggest yourself
    expect(suggestions).not.toContain("norecipes"); // no public recipe to fill a feed
  });

  it("searches handle, display name and bio", async () => {
    const chef = await createTestUser();
    await createProfile(chef.id, "gordon", {
      displayName: "Gordon Ramsay",
      bio: "angry chef",
    });

    expect((await searchPublicProfiles("gordon", 10)).map((p) => p.handle)).toContain("gordon");
    expect((await searchPublicProfiles("Ramsay", 10)).map((p) => p.handle)).toContain("gordon");
    expect((await searchPublicProfiles("angry", 10)).map((p) => p.handle)).toContain("gordon");
  });

  it("lists private profiles as shells: found, marked private, recipe count hidden", async () => {
    // v1 private profiles (Instagram-like): they appear in search/directory as a
    // shell — identity visible, isPublic=false, and their public-recipe count is
    // never surfaced (forced to 0) so a private cook's recipes stay hidden.
    const hidden = await createTestUser();
    await createProfile(hidden.id, "secret", {
      isPublic: false,
      displayName: "Gordon Hidden",
    });
    await givePublicRecipe(hidden.id); // even a public recipe must not be counted

    const [row] = await searchPublicProfiles("Gordon Hidden", 10);

    expect(row?.handle).toBe("secret");
    expect(row?.isPublic).toBe(false);
    expect(row?.recipeCount).toBe(0);
  });
});
