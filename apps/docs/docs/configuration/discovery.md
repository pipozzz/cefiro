---
sidebar_position: 13
title: Discovery themes (embeddings)
description: Semantic discovery themes powered by Voyage AI embeddings + pgvector.
---

# Discovery themes (embeddings)

The public **Discover** page can show **semantic themes** — clusters of similar
public recipes, each surfacing recipes by meaning rather than by matching tags.
This is powered by [Voyage AI](https://www.voyageai.com) embeddings stored in
**pgvector**. It is **optional**: without a Voyage key, recipes are simply not
embedded and Discover falls back to tag-based themes.

## Requirements

- The database must use the **pgvector** Postgres image (the shipped
  `docker/` compose already does). The embedding table + extension are created by
  the migrations.
- A Voyage AI API key.

## Enable

```yaml title="docker-compose.yml (environment)"
VOYAGE_API_KEY: <voyage-api-key>
```

| Variable          | Description                                          | Default                                  |
| ----------------- | ---------------------------------------------------- | ---------------------------------------- |
| `VOYAGE_API_KEY`  | Voyage AI API key. Store as a secret — never commit. | —                                        |
| `VOYAGE_MODEL`    | Embedding model (1024-dim).                          | `voyage-3`                               |
| `VOYAGE_ENDPOINT` | Embeddings API endpoint.                             | `https://api.voyageai.com/v1/embeddings` |

Set these on both the `web` and `worker` services (the worker runs the embedding
and clustering jobs).

## How it fills in

1. New and edited **public** recipes are embedded automatically.
2. **Settings → Admin → AI processing → Embed all public recipes** backfills the
   recipes that existed before embeddings were turned on.
3. **Rebuild discovery themes** clusters the embeddings and names each theme; it
   also runs weekly. A theme appears once there are enough embedded public
   recipes to form one.
