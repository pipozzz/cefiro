# Cefiro MCP server

An [MCP](https://modelcontextprotocol.io) server that lets any MCP client — Claude
Desktop, an agent, your own script — **create and search recipes** on a Cefiro
instance conversationally. It is a thin wrapper over Cefiro's public REST API
(`/api/v1`), authenticated with an API key, so it can do exactly what that key's
owner can already do over HTTP.

It is isolated from the monorepo (its own `pnpm-workspace.yaml`), so it installs
and builds on its own and is not part of the app's CI build.

## Tools

- **`create_recipe`** — create a recipe (defaults to **public** so it shows up in
  Discover and search). Takes name, description, servings, prep/cook minutes,
  categories, ingredients, steps, tags, and an optional cuisine name.
- **`list_cuisines`** — list the instance's cuisine vocabulary (names). New
  cuisines are added by an administrator in the app, not here.
- **`search_recipes`** — search recipes by text.
- **`get_recipe`** — fetch one recipe by id.
- **`update_recipe`** — edit an existing recipe; only the fields you pass change.
  Covers name, description, servings, prep/cook minutes, categories, tags,
  ingredients, steps, cuisine, and the provenance (`provenanceNote`,
  `originCountry` as an ISO alpha-2 code, `originCountryName`, `originRegion`;
  `null` clears a field). Provenance you set is kept: automatic AI enrichment only
  fills empty provenance fields. Each step is either a string, which keeps the
  images and ingredient links of the step at that position, or
  `{ text, ingredients: [{ index, share? }] }`, which sets that step's
  step↔ingredient links explicitly (`index` is the 0-based position in the
  ingredient list, `share` the fraction of the line the step uses, default 1;
  `[]` clears the links).
- **`set_recipe_visibility`** — publish (public), share by link (unlisted), or
  unpublish (private) a recipe.
- **`delete_recipe`** — permanently delete a recipe.
- **`create_cuisine`** — add a cuisine to the vocabulary (administrator key).
- **`add_recipe_image`** — attach a gallery image from base64 bytes.

Example — restore a recipe's step links and fix its provenance note:

```json
{
  "id": "<recipe-id>",
  "provenanceNote": "A Liptov shepherds' dish, cooked over an open fire.",
  "steps": [
    { "text": "Boil the potatoes.", "ingredients": [{ "index": 0 }] },
    {
      "text": "Fry the onion in half the butter.",
      "ingredients": [{ "index": 1 }, { "index": 2, "share": 0.5 }]
    },
    "Serve hot."
  ]
}
```

## Setup

1. In Cefiro, go to **Settings → API keys** and create a key.
2. Build the server:

   ```bash
   cd apps/mcp
   pnpm install
   pnpm build
   ```

3. Configure your MCP client. For Claude Desktop, add to
   `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "cefiro": {
         "command": "node",
         "args": ["/absolute/path/to/cefiro/apps/mcp/dist/index.js"],
         "env": {
           "CEFIRO_API_URL": "https://nasakuchyna.sk",
           "CEFIRO_API_KEY": "<your-api-key>"
         }
       }
     }
   }
   ```

## Environment

| Variable         | Required | Description                                               |
| ---------------- | -------- | --------------------------------------------------------- |
| `CEFIRO_API_URL` | yes      | Base URL of the instance, e.g. `https://nasakuchyna.sk`   |
| `CEFIRO_API_KEY` | yes      | An API key from Settings → API keys (sent as `x-api-key`) |

## A note on content

`create_recipe` publishes public content by default. Only create original recipes
or content you have the right to publish — the same rule the app's copyright
guardrails enforce for bulk publishing.
