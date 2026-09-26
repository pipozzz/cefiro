---
sidebar_position: 3
title: MCP server
description: Create and search recipes from any MCP client (Claude Desktop, agents) over the public API.
---

# MCP server

Cefiro ships an [MCP](https://modelcontextprotocol.io) server (`apps/mcp`) that
lets any MCP client — Claude Desktop, an agent, your own script — **create and
search recipes** conversationally. It is a thin wrapper over the
[public API](./api.md): it does exactly what its API key's owner can already do
over HTTP.

It is isolated from the app (its own install root) and is **not** part of the web
build — you run it separately, wherever your MCP client is.

## Tools

| Tool                    | What it does                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `create_recipe`         | Create a recipe. Defaults to **public**, so it shows in Discover. |
| `set_recipe_visibility` | Publish / link-only / unpublish an existing recipe.               |
| `add_recipe_image`      | Attach a gallery image from base64 bytes.                         |
| `delete_recipe`         | Delete a recipe (fetches its version first).                      |
| `list_cuisines`         | List the cuisine vocabulary (names) to use with `create_recipe`.  |
| `create_cuisine`        | Add a cuisine to the vocabulary (needs an admin API key).         |
| `search_recipes`        | Search recipes by text.                                           |
| `get_recipe`            | Fetch one recipe by id.                                           |

`create_recipe` accepts name, description, servings, prep/cook minutes,
categories (`Breakfast` / `Lunch` / `Dinner` / `Snack`), ingredients, steps,
tags, an optional cuisine **name** (resolved against the vocabulary; unknown
names are skipped), and `visibility` (default `public`).

`create_cuisine` needs an administrator API key; with a regular key, add cuisines
in the app (Admin → Cuisines) instead. Updating a recipe's data is done over the
API (`PATCH /recipes/{id}`), not through a tool.

## Setup

1. In Cefiro, open **Settings → API keys** and create a key.
2. Build the server:

   ```bash
   cd apps/mcp
   pnpm install
   pnpm build
   ```

3. Point your MCP client at it. For Claude Desktop, add to
   `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "cefiro": {
         "command": "node",
         "args": ["/absolute/path/to/cefiro/apps/mcp/dist/index.js"],
         "env": {
           "CEFIRO_API_URL": "https://your-instance.example",
           "CEFIRO_API_KEY": "<your-api-key>"
         }
       }
     }
   }
   ```

## Environment

| Variable         | Required | Description                                                    |
| ---------------- | -------- | -------------------------------------------------------------- |
| `CEFIRO_API_URL` | yes      | Base URL of the instance, e.g. `https://your-instance.example` |
| `CEFIRO_API_KEY` | yes      | An API key from Settings → API keys (sent as `x-api-key`)      |

## Publishing responsibly

`create_recipe` publishes public content by default. Only create original recipes
or content you have the right to publish — the same rule the app's copyright
guardrails enforce for bulk publishing.
