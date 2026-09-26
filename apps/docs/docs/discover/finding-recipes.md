---
sidebar_position: 1
title: Finding recipes
description: Discover public recipes by theme, cuisine, category, ingredients and search — the community-facing way to find something to cook.
---

# Finding recipes

**Discover** is the community-facing way to find something to cook. It shows
public recipes from everyone on the instance and is reachable at `/discover`,
signed in or out.

<!-- TODO screenshot: /img/screenshots/discover-page.png — the Discover page -->

## Themes

The strip at the top of Discover is a set of **themes** — groups of recipes that
belong together, learned from the recipes themselves rather than from tags. Each
theme is built by embedding public recipes and clustering them, then naming the
cluster; opening a theme runs a similarity search, so it stays fresh as the
catalogue grows. Themes need the embeddings backend configured — see
[Discovery configuration](../configuration/discovery.md).

## Cuisines

Every cuisine that has public recipes gets its own landing page:

- `/discover/cuisine` — an index of all cuisines, most-used first, with a recipe
  count each.
- `/discover/cuisine/<cuisine>` — the public recipes for one cuisine.

These pages are server-rendered and listed in the sitemap, so they are
crawlable and grow automatically as more recipes are published — a durable way
for search engines to find your recipes by cuisine.

<!-- TODO screenshot: /img/screenshots/discover-cuisine-hub.png — a cuisine landing page -->

## Categories

Alongside cuisines, recipes are grouped by meal **category** (Breakfast, Lunch,
Dinner, Snack) at `/discover/category/<category>`, with an index at
`/discover/category`.

## Search and other ways in

- **Search** — full-text search across public recipes and cooks.
- **Cook with what you have** — search by the ingredients on hand.
- **Surprise me** — a random handful of public recipes.
- **More like this** — related recipes on any public recipe page.
- **Following** — a tab of the latest from the cooks you follow.

Signed-in readers can also narrow Discover by category, cuisine, maximum cooking
time, and — when set — hide recipes tagged with their own allergens.
