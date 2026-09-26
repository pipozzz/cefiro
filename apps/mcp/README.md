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
