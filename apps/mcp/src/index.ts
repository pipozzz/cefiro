#!/usr/bin/env node
/**
 * Cefiro MCP server.
 *
 * Exposes recipe tools (create, search, get) to any MCP client — Claude Desktop,
 * an agent, etc. — so recipes can be added and looked up conversationally. It is
 * a thin wrapper over Cefiro's public REST API (`/api/v1`), authenticated with an
 * API key, so it grants exactly what that key's owner can already do over HTTP.
 *
 * Configuration (environment):
 *   CEFIRO_API_URL   Base URL of the instance, e.g. https://nasakuchyna.sk
 *   CEFIRO_API_KEY   An API key from Settings → API keys (sent as x-api-key)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.CEFIRO_API_URL ?? "").replace(/\/+$/, "");
const API_KEY = process.env.CEFIRO_API_KEY ?? "";

if (!BASE || !API_KEY) {
  // stderr, so it never corrupts the stdio protocol on stdout.
  console.error("cefiro-mcp: CEFIRO_API_URL and CEFIRO_API_KEY must both be set.");
  process.exit(1);
}

const API = `${BASE}/api/v1`;

/** Call the Cefiro REST API with the API key; returns parsed JSON (or text). */
async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : text || res.statusText;

    throw new Error(`${res.status} ${res.statusText}: ${message}`);
  }

  return data;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const CATEGORY = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);
const VISIBILITY = z.enum(["private", "unlisted", "public"]);

type Cuisine = { id: string; name: string };

/** Resolve a cuisine name to its id from the instance's vocabulary. */
async function resolveCuisineId(name: string): Promise<string | null> {
  const data = (await api("/cuisines")) as { cuisines?: Cuisine[] };
  const wanted = name.trim().toLowerCase();
  const match = (data.cuisines ?? []).find((c) => c.name.trim().toLowerCase() === wanted);

  return match?.id ?? null;
}

const server = new McpServer({ name: "cefiro", version: "0.24.0-beta" });

server.registerTool(
  "list_cuisines",
  {
    title: "List cuisines",
    description:
      "List the instance's cuisine vocabulary (names). Pass one of these names as `cuisine` to create_recipe. New cuisines are added by an administrator in the app, not here.",
    inputSchema: {},
  },
  async () => {
    const data = (await api("/cuisines")) as { cuisines?: Cuisine[] };
    const names = (data.cuisines ?? []).map((c) => c.name);

    return textResult(
      names.length
        ? names.join(", ")
        : "No cuisines are defined yet — add them in Admin → Cuisines."
    );
  }
);

server.registerTool(
  "search_recipes",
  {
    title: "Search recipes",
    description: "Search the caller's recipes by text.",
    inputSchema: {
      query: z.string().min(1).describe("Search text"),
      limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
    },
  },
  async ({ query, limit }) => {
    const data = await api("/recipes/search", {
      method: "POST",
      body: JSON.stringify({ query, limit: limit ?? 20 }),
    });

    return textResult(JSON.stringify(data, null, 2));
  }
);

server.registerTool(
  "get_recipe",
  {
    title: "Get recipe",
    description: "Fetch one recipe by id.",
    inputSchema: { id: z.string().describe("Recipe id (uuid)") },
  },
  async ({ id }) => {
    const data = await api(`/recipes/${encodeURIComponent(id)}`);

    return textResult(JSON.stringify(data, null, 2));
  }
);

server.registerTool(
  "create_recipe",
  {
    title: "Create recipe",
    description:
      "Create a recipe. Defaults to public so it appears in Discover and search. Only create original content or content you have the right to publish.",
    inputSchema: {
      name: z.string().min(1).describe("Recipe title"),
      description: z.string().optional().describe("Short description"),
      servings: z.number().int().positive().optional(),
      prepMinutes: z.number().int().nonnegative().optional(),
      cookMinutes: z.number().int().nonnegative().optional(),
      categories: z.array(CATEGORY).optional().describe("Meal categories"),
      ingredients: z
        .array(
          z.object({
            name: z.string().min(1),
            amount: z.number().nullable().optional(),
            unit: z.string().nullable().optional(),
          })
        )
        .describe("Ingredient lines"),
      steps: z.array(z.string().min(1)).describe("Method, one string per step"),
      tags: z.array(z.string().min(1)).optional().describe("Free-text tags"),
      cuisine: z
        .string()
        .optional()
        .describe("Cuisine name (must already exist; see list_cuisines). Ignored if unknown."),
      visibility: VISIBILITY.optional().describe("Default: public"),
    },
  },
  async (input) => {
    let cuisineIds: string[] = [];
    let cuisineNote = "";

    if (input.cuisine) {
      const id = await resolveCuisineId(input.cuisine);

      if (id) {
        cuisineIds = [id];
      } else {
        cuisineNote = ` (cuisine "${input.cuisine}" not found — created without it; add it in Admin → Cuisines first)`;
      }
    }

    const prep = input.prepMinutes ?? null;
    const cook = input.cookMinutes ?? null;
    const total = prep != null && cook != null ? prep + cook : null;

    const body = {
      name: input.name,
      description: input.description ?? null,
      servings: input.servings ?? 1,
      prepMinutes: prep,
      cookMinutes: cook,
      totalMinutes: total,
      systemUsed: "metric" as const,
      categories: input.categories ?? [],
      recipeIngredients: input.ingredients.map((ing, order) => ({
        ingredientName: ing.name,
        ingredientId: null,
        amount: ing.amount ?? null,
        unit: ing.unit ?? null,
        systemUsed: "metric" as const,
        order,
      })),
      steps: input.steps.map((step, order) => ({
        step,
        systemUsed: "metric" as const,
        order,
        images: [],
        stepIngredients: [],
      })),
      tags: (input.tags ?? []).map((name) => ({ name })),
      cuisines: cuisineIds,
      images: [],
      videos: [],
      visibility: input.visibility ?? "public",
    };

    const data = await api("/recipes", { method: "POST", body: JSON.stringify(body) });
    const id = typeof data === "string" ? data : JSON.stringify(data);

    return textResult(`Created recipe ${id}${cuisineNote}`);
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();

  await server.connect(transport);
  // A ready line on stderr; stdout is reserved for the protocol.
  console.error(`cefiro-mcp connected to ${BASE}`);
}

main().catch((err: unknown) => {
  console.error("cefiro-mcp fatal:", err);
  process.exit(1);
});
