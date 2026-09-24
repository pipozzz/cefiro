// @vitest-environment node
/**
 * The themes repository (Phase B2): the clustering job rebuilds the whole table
 * each run, and discovery reads it back in rank order. This also exercises the
 * pgvector `centroid` column round-tripping a `number[]` through the custom type.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRecipeWithRefs } from "@norish/db/repositories/recipes";
import { getRecipeNamesByIds, listThemes, replaceThemes } from "@norish/db/repositories/themes";

import { createTestUser } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("themes_repo");

let userId: string;

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => {
  await testBase.beforeEachTest();
  userId = (await createTestUser()).id;
});

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

/** A 1024-dim centroid (the vector column's width) with a couple of markers. */
function centroid(first: number, second: number): number[] {
  const vec = new Array<number>(1024).fill(0);

  vec[0] = first;
  vec[1] = second;

  return vec;
}

async function seedRecipe(name: string): Promise<string> {
  const id = crypto.randomUUID();

  await createRecipeWithRefs(id, userId, { ...BASE_RECIPE, name });

  return id;
}

describe("themes repository", () => {
  it("replaces the table and reads themes back in rank order, centroid intact", async () => {
    const repA = await seedRecipe("Ramen");
    const repB = await seedRecipe("Cheesecake");

    await replaceThemes([
      {
        name: "Ázijské rýchlovky",
        recipeCount: 9,
        centroid: centroid(1, 0),
        representativeRecipeId: repA,
        slug: "ramen",
        image: "/recipes/ramen/hero.jpg",
        rank: 0,
      },
      {
        name: "Sladké pečivo",
        recipeCount: 5,
        centroid: centroid(0, 1),
        representativeRecipeId: repB,
        slug: "cheesecake",
        image: "/recipes/cheesecake/hero.jpg",
        rank: 1,
      },
    ]);

    const themes = await listThemes(10);

    expect(themes.map((theme) => theme.name)).toEqual(["Ázijské rýchlovky", "Sladké pečivo"]);
    expect(themes[0]!.recipeCount).toBe(9);
    expect(themes[0]!.representativeRecipeId).toBe(repA);
    expect(themes[0]!.centroid).toHaveLength(1024);
    expect(themes[0]!.centroid[0]).toBeCloseTo(1, 6);
    expect(themes[0]!.centroid[1]).toBeCloseTo(0, 6);
    expect(themes[1]!.centroid[1]).toBeCloseTo(1, 6);
  });

  it("clears the table when replaced with nothing", async () => {
    await replaceThemes([
      {
        name: "Solo",
        recipeCount: 3,
        centroid: centroid(1, 0),
        representativeRecipeId: null,
        slug: null,
        image: null,
        rank: 0,
      },
    ]);
    expect(await listThemes(10)).toHaveLength(1);

    await replaceThemes([]);
    expect(await listThemes(10)).toEqual([]);
  });

  it("looks up recipe names by id for cluster titles", async () => {
    const id = await seedRecipe("Goulash");
    const names = await getRecipeNamesByIds([id]);

    expect(names.get(id)).toBe("Goulash");
  });
});
