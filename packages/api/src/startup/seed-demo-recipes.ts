import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db/repositories/recipes";
import { setRecipeVisibility } from "@norish/db/repositories/user-profiles";
import { getServerOwnerId } from "@norish/db/repositories/users";
import { serverLogger } from "@norish/shared-server/logger";

type SeedIngredient = { name: string; amount: number | null; unit: string | null };

type SeedRecipe = {
  /** Stable id so a re-run is a no-op (idempotent). */
  id: string;
  name: string;
  description: string;
  categories: ("Breakfast" | "Lunch" | "Dinner" | "Snack")[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: SeedIngredient[];
  steps: string[];
};

/**
 * A small, curated set of public recipes to give a fresh instance something for
 * discovery and search to show on day one. Fixed ids keep seeding idempotent;
 * plain Slovak classics keep it honest (no scraped/copyrighted content).
 */
const CURATED: SeedRecipe[] = [
  {
    id: "d1a7c0de-0000-4000-a000-000000000001",
    name: "Bryndzové halušky",
    description: "Slovenská klasika: zemiakové halušky s bryndzou a opraženou slaninkou.",
    categories: ["Dinner"],
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 20,
    ingredients: [
      { name: "zemiaky", amount: 1, unit: "kg" },
      { name: "hladká múka", amount: 300, unit: "g" },
      { name: "bryndza", amount: 250, unit: "g" },
      { name: "údená slanina", amount: 150, unit: "g" },
      { name: "soľ", amount: null, unit: null },
    ],
    steps: [
      "Zemiaky ošúpeme a nastrúhame najemno. Zmiešame s múkou a soľou na hustejšie cesto.",
      "Cesto pretláčame cez haluškár do vriacej osolenej vody. Halušky varíme, kým nevyplávajú.",
      "Slaninu nakrájame na kocky a do chrumkava vyškvaríme.",
      "Bryndzu rozmiešame s trochou horúcej vody na krém, zamiešame do scedených halušiek a posypeme slaninkou.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000002",
    name: "Kapustnica",
    description: "Vývarová kyslá kapustnica s údeným mäsom a klobásou — sviatočná aj všedná.",
    categories: ["Lunch", "Dinner"],
    servings: 6,
    prepMinutes: 20,
    cookMinutes: 90,
    ingredients: [
      { name: "kyslá kapusta", amount: 800, unit: "g" },
      { name: "údené mäso", amount: 400, unit: "g" },
      { name: "klobása", amount: 200, unit: "g" },
      { name: "cibuľa", amount: 1, unit: "ks" },
      { name: "sušené hríby", amount: 30, unit: "g" },
      { name: "mletá paprika", amount: 1, unit: "PL" },
    ],
    steps: [
      "Údené mäso zalejeme vodou a varíme do mäkka, asi 60 minút. Vývar si necháme.",
      "Pridáme scedenú kyslú kapustu, namočené hríby a nakrájanú cibuľu, varíme ďalej.",
      "Vmiešame papriku a kolieska klobásy, dovaríme ešte 20 minút a podľa chuti dosolíme.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000003",
    name: "Šúľance s makom",
    description: "Sladké zemiakové šúľance obalené v masle, maku a cukre.",
    categories: ["Snack", "Dinner"],
    servings: 4,
    prepMinutes: 25,
    cookMinutes: 10,
    ingredients: [
      { name: "zemiaky", amount: 500, unit: "g" },
      { name: "hladká múka", amount: 200, unit: "g" },
      { name: "mletý mak", amount: 80, unit: "g" },
      { name: "práškový cukor", amount: 60, unit: "g" },
      { name: "maslo", amount: 50, unit: "g" },
    ],
    steps: [
      "Uvarené zemiaky popučíme, zmiešame s múkou a štipkou soli na vláčne cesto.",
      "Z cesta váľame tenké valčeky a krájame na šúľance. Varíme v osolenej vode, kým nevyplávajú.",
      "Scedené šúľance premiešame s roztopeným maslom a posypeme mletým makom s cukrom.",
    ],
  },
];

/**
 * Seed the curated public recipes — cold-start only.
 *
 * Runs solely when `SEED_DEMO_RECIPES` is set, so a normal boot (and CI) does
 * nothing. Attaches the recipes to the server owner's account (no user is
 * created — the owner's email/name stay encrypted and untouched), publishes
 * each, and skips any that already exist by id, so repeated runs never
 * duplicate. To remove them later, delete the recipes from the owner's library.
 */
export async function seedDemoRecipes(): Promise<void> {
  if (!SERVER_CONFIG.SEED_DEMO_RECIPES) {
    return;
  }

  const ownerId = await getServerOwnerId();

  if (!ownerId) {
    serverLogger.warn("SEED_DEMO_RECIPES is on but there is no server owner yet; skipping");

    return;
  }

  let created = 0;

  for (const recipe of CURATED) {
    const existing = await getRecipeFull(recipe.id);

    if (existing) {
      continue;
    }

    await createRecipeWithRefs(recipe.id, ownerId, {
      name: recipe.name,
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
      systemUsed: "metric",
      categories: recipe.categories,
      recipeIngredients: recipe.ingredients.map((ingredient, order) => ({
        ingredientName: ingredient.name,
        ingredientId: null,
        amount: ingredient.amount,
        unit: ingredient.unit,
        systemUsed: "metric",
        order,
      })),
      steps: recipe.steps.map((step, order) => ({
        step,
        systemUsed: "metric",
        order,
        images: [],
        stepIngredients: [],
      })),
      tags: [],
      cuisines: [],
      images: [],
      videos: [],
    });

    // Publish it so it reaches discovery, profiles and the sitemap.
    await setRecipeVisibility(ownerId, recipe.id, "public");
    created += 1;
  }

  if (created > 0) {
    serverLogger.info({ created, ownerId }, "Seeded curated demo recipes");
  } else {
    serverLogger.info("Curated demo recipes already present; nothing to seed");
  }
}
