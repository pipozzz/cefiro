import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createCuisines } from "@norish/db/repositories/cuisines";
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
  tags: string[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: SeedIngredient[];
  steps: string[];
};

/** Every seeded recipe is a Slovak classic, so they share one cuisine. */
const SEED_CUISINE = "Slovenská";

/**
 * A curated set of public recipes to give a fresh instance something for
 * discovery, search, the cuisine/category hubs and semantic themes to show on
 * day one. Fixed ids keep seeding idempotent; every recipe is a plain Slovak
 * classic written from scratch, so nothing here is scraped or copyrighted — the
 * dish is common knowledge and the wording is original.
 */
const CURATED: SeedRecipe[] = [
  {
    id: "d1a7c0de-0000-4000-a000-000000000001",
    name: "Bryndzové halušky",
    description: "Slovenská klasika: zemiakové halušky s bryndzou a opraženou slaninkou.",
    categories: ["Dinner"],
    tags: ["tradičné", "bryndza", "zemiaky"],
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
    tags: ["polievka", "kyslá kapusta", "tradičné"],
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
    tags: ["sladké", "mak", "zemiaky"],
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
  {
    id: "d1a7c0de-0000-4000-a000-000000000004",
    name: "Segedínsky guláš",
    description: "Bravčové mäso dusené s kyslou kapustou a smotanou, jemne pikantné.",
    categories: ["Lunch", "Dinner"],
    tags: ["guláš", "bravčové", "kyslá kapusta"],
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 70,
    ingredients: [
      { name: "bravčové pliecko", amount: 600, unit: "g" },
      { name: "kyslá kapusta", amount: 400, unit: "g" },
      { name: "cibuľa", amount: 2, unit: "ks" },
      { name: "mletá paprika", amount: 1, unit: "PL" },
      { name: "kyslá smotana", amount: 200, unit: "g" },
      { name: "rasca", amount: 1, unit: "ČL" },
    ],
    steps: [
      "Na oleji opražíme nadrobno nakrájanú cibuľu do sklovita, odstavíme a vmiešame papriku.",
      "Pridáme mäso nakrájané na kocky, rascu a soľ, podlejeme vodou a dusíme asi 40 minút.",
      "Vmiešame scedenú kapustu a dusíme ďalších 20 minút do mäkka.",
      "Nakoniec zjemníme kyslou smotanou a krátko prevaríme.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000005",
    name: "Zemiakové placky",
    description: "Chrumkavé cesnakové placky zo strúhaných zemiakov, pečené na panvici.",
    categories: ["Snack", "Dinner"],
    tags: ["zemiaky", "cesnak", "vegetariánske"],
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 20,
    ingredients: [
      { name: "zemiaky", amount: 800, unit: "g" },
      { name: "hladká múka", amount: 4, unit: "PL" },
      { name: "vajce", amount: 1, unit: "ks" },
      { name: "cesnak", amount: 3, unit: "strúčik" },
      { name: "majorán", amount: 1, unit: "ČL" },
    ],
    steps: [
      "Zemiaky nastrúhame najemno a mierne vytlačíme prebytočnú vodu.",
      "Zmiešame s múkou, vajcom, pretlačeným cesnakom, majoránom a soľou na hustejšie cesto.",
      "Na rozpálenom oleji pečieme tenké placky z oboch strán dozlatista.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000006",
    name: "Cesnaková polievka",
    description: "Výdatná cesnaková polievka so zemiakmi, hriankami a syrom.",
    categories: ["Lunch"],
    tags: ["polievka", "cesnak", "rýchle"],
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    ingredients: [
      { name: "cesnak", amount: 1, unit: "hlava" },
      { name: "zemiaky", amount: 3, unit: "ks" },
      { name: "zeleninový vývar", amount: 1.2, unit: "l" },
      { name: "rasca", amount: 1, unit: "ČL" },
      { name: "tvrdý syr", amount: 80, unit: "g" },
      { name: "chlieb na hrianky", amount: 4, unit: "krajec" },
    ],
    steps: [
      "Do vývaru pridáme zemiaky nakrájané na kocky, rascu a soľ, varíme do mäkka.",
      "Vmiešame pretlačený cesnak a krátko prevaríme, aby si zachoval chuť.",
      "Podávame posypané strúhaným syrom a opečenými hriankami.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000007",
    name: "Vyprážaný syr",
    description: "Zlatistý vyprážaný syr v trojobale, klasika s tatárskou omáčkou.",
    categories: ["Dinner"],
    tags: ["vyprážané", "syr", "rýchle"],
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 10,
    ingredients: [
      { name: "eidam", amount: 300, unit: "g" },
      { name: "hladká múka", amount: 60, unit: "g" },
      { name: "vajce", amount: 2, unit: "ks" },
      { name: "strúhanka", amount: 100, unit: "g" },
      { name: "olej na vyprážanie", amount: null, unit: null },
    ],
    steps: [
      "Syr nakrájame na hrubšie plátky. Pripravíme si tri misky: múku, rozšľahané vajcia a strúhanku.",
      "Každý plátok obalíme postupne v múke, vajci a strúhanke; pre istotu obalíme ešte raz vo vajci a strúhanke.",
      "Vyprážame v rozpálenom oleji z oboch strán dozlatista a necháme odkvapkať.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000008",
    name: "Strapačky s kyslou kapustou",
    description: "Halušky premiešané s dusenou kyslou kapustou a slaninkou.",
    categories: ["Dinner"],
    tags: ["halušky", "kyslá kapusta", "tradičné"],
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 25,
    ingredients: [
      { name: "zemiaky", amount: 800, unit: "g" },
      { name: "hladká múka", amount: 250, unit: "g" },
      { name: "kyslá kapusta", amount: 400, unit: "g" },
      { name: "cibuľa", amount: 1, unit: "ks" },
      { name: "údená slanina", amount: 100, unit: "g" },
    ],
    steps: [
      "Zo strúhaných zemiakov, múky a soli pripravíme cesto a cez haluškár uvaríme halušky.",
      "Na slaninke opražíme cibuľu, pridáme scedenú kyslú kapustu a chvíľu podusíme.",
      "Do kapusty vmiešame scedené halušky a spolu krátko preohrejeme.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000009",
    name: "Fazuľová polievka",
    description: "Hustá fazuľová polievka s klobásou a zeleninou.",
    categories: ["Lunch"],
    tags: ["polievka", "fazuľa", "výdatné"],
    servings: 5,
    prepMinutes: 15,
    cookMinutes: 60,
    ingredients: [
      { name: "fazuľa", amount: 300, unit: "g" },
      { name: "klobása", amount: 150, unit: "g" },
      { name: "zemiaky", amount: 2, unit: "ks" },
      { name: "mrkva", amount: 1, unit: "ks" },
      { name: "cibuľa", amount: 1, unit: "ks" },
      { name: "mletá paprika", amount: 1, unit: "ČL" },
    ],
    steps: [
      "Namočenú fazuľu varíme v osolenej vode do polomäkka.",
      "Pridáme nakrájané zemiaky, mrkvu a cibuľu, varíme do mäkka.",
      "Zjemníme paprikou, vložíme kolieska klobásy a ešte 10 minút prevaríme.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000010",
    name: "Palacinky",
    description: "Tenké sladké palacinky s džemom — obľúbené na raňajky aj olovrant.",
    categories: ["Breakfast", "Snack"],
    tags: ["sladké", "raňajky", "deti"],
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [
      { name: "hladká múka", amount: 250, unit: "g" },
      { name: "mlieko", amount: 500, unit: "ml" },
      { name: "vajce", amount: 2, unit: "ks" },
      { name: "cukor", amount: 1, unit: "PL" },
      { name: "džem", amount: null, unit: null },
    ],
    steps: [
      "Múku, mlieko, vajcia, cukor a štipku soli rozšľaháme na hladké redšie cesto.",
      "Na rozohriatej panvici pečieme tenké palacinky z oboch strán.",
      "Každú potrieme džemom a zvinieme; podľa chuti posypeme cukrom.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000011",
    name: "Lečo s klobásou",
    description: "Dusená paprika s paradajkami, cibuľou a klobásou, zjemnené vajcom.",
    categories: ["Lunch", "Dinner"],
    tags: ["paprika", "klobása", "rýchle"],
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    ingredients: [
      { name: "paprika", amount: 600, unit: "g" },
      { name: "paradajky", amount: 400, unit: "g" },
      { name: "cibuľa", amount: 2, unit: "ks" },
      { name: "klobása", amount: 200, unit: "g" },
      { name: "vajce", amount: 2, unit: "ks" },
      { name: "mletá paprika", amount: 1, unit: "ČL" },
    ],
    steps: [
      "Na oleji opražíme cibuľu a kolieska klobásy.",
      "Pridáme nakrájanú papriku a paradajky, ochutíme mletou paprikou a soľou, dusíme do mäkka.",
      "Nakoniec vmiešame rozšľahané vajcia a necháme jemne stuhnúť.",
    ],
  },
  {
    id: "d1a7c0de-0000-4000-a000-000000000012",
    name: "Praženica so slaninou",
    description: "Rýchle raňajky: praženica z vajec so slaninkou a cibuľkou.",
    categories: ["Breakfast"],
    tags: ["vajcia", "raňajky", "rýchle"],
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [
      { name: "vajce", amount: 4, unit: "ks" },
      { name: "údená slanina", amount: 80, unit: "g" },
      { name: "cibuľa", amount: 1, unit: "ks" },
      { name: "maslo", amount: 10, unit: "g" },
      { name: "pažítka", amount: null, unit: null },
    ],
    steps: [
      "Slaninu nakrájame na kocky a vyškvaríme, pridáme nadrobno nakrájanú cibuľu a opražíme.",
      "Zalejeme rozšľahanými vajcami, osolíme a za stáleho miešania pripravíme praženicu.",
      "Posypeme nasekanou pažítkou a podávame s chlebom.",
    ],
  },
];

/**
 * Seed the curated public recipes — cold-start only.
 *
 * Runs solely when `SEED_DEMO_RECIPES` is set, so a normal boot (and CI) does
 * nothing. Attaches the recipes to the server owner's account (no user is
 * created — the owner's email/name stay encrypted and untouched), tags them,
 * files them under the Slovak cuisine so the cuisine hub is populated, and
 * publishes each. Skips any that already exist by id, so repeated runs never
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

  // Ensure the shared cuisine exists in the governed vocabulary and resolve its
  // id (createCuisines tolerates an already-present name and returns the row).
  const [cuisine] = await createCuisines([SEED_CUISINE]);
  const cuisineIds = cuisine ? [cuisine.id] : [];

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
      tags: recipe.tags.map((name) => ({ name })),
      cuisines: cuisineIds,
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
