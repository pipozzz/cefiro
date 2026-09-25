# Cefiro

**Cefiro is a social recipe platform and hands-on cooking helper for home cooks — not just another recipe website.** Discover what to cook, plan the week, shop for it, and get guided while you're at the stove.

Live: **[cefiro.spertulo.sk](https://cefiro.spertulo.sk)**

<p align="left">
  <a href="https://cefiro.spertulo.sk"><img src="https://img.shields.io/badge/Live-cefiro.spertulo.sk-336640?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live site" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-336640?style=for-the-badge" alt="License: AGPL-3.0" /></a>
</p>

> Cefiro is an [AGPL-3.0](LICENSE) fork of **[Norish](https://norish.dev)** ([norish-recipes/Norish](https://github.com/norish-recipes/Norish)). It keeps Norish's real-time, household-first, self-hostable core and adds a community **discovery** layer and a set of **cooking-assistant** features. See [Built on Norish](#built-on-norish).

---

## What Cefiro adds on top of Norish

### 🔎 Discover — the primary way to find recipes

The public `/discover` surface is built for signed-out visitors as much as members:

- **Cook with what you have** — enter the ingredients in your fridge; recipes are ranked by how many you have, each showing **what's still missing** and a one-tap **"add missing to your shopping list"**.
- **Trending topics** — the most-used tags across public recipes, as quick chips.
- **Ready in…** — filter to recipes you can make in ≤15 / 30 / 60 min.
- **Dietary-aware** — hide recipes that contain your allergens (resolved server-side, never leaked into the URL).
- **Surprise me** — a shuffle of random public recipes.
- **Recipe of the day** — one curated pick, the same for everyone, rotating daily.
- **More like this** — related recipes on every public recipe page, so a link-arriving reader has somewhere to go next.
- Unified search over your own library **and** the community, and a feed that seeds a cold start with popular recipes.
- Public recipe / profile pages ship **schema.org JSON-LD** for rich search results.

### 🍳 Cook — a helper at the stove

- **Cook mode** with step-by-step view, keep-screen-awake, and per-step **timers** detected from the text ("… 10 min").
- **Manual step timers** — add a timer to any step from the editor with a tap.
- A **running timer clearly shows it's on** (solid, pulsing) and a completed one alerts you.
- Slovak time words are recognised out of the box (`minút`, `hodina`, …).

### 🗓️ Plan → shop → cook

- **Generate a shopping list from the week's meal plan** in one tap — ingredients across all planned recipes are summed and merged.
- The classic household groceries, calendar and cookbooks (in Slovak: _Receptáre_) from Norish.

---

## Quick start (self-host)

Cefiro self-hosts the same way as Norish — a container plus Postgres, Redis, and the page-renderer. At a minimum you need a `DATABASE_URL` and a `MASTER_KEY`.

> [!TIP]
> Generate a `MASTER_KEY` with `openssl rand -base64 32`. Keep it secret and **stable** — it derives the encryption keys, so changing it later invalidates previously encrypted data.

The app image is built from this repository (see [`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)); the example below builds it locally. Adjust the image reference if you publish your own.

```yaml
services:
  cefiro:
    build: . # or: image: <your-registry>/cefiro:latest
    container_name: cefiro-app
    restart: always
    ports:
      - "3000:3000"
    user: "1000:1000"
    volumes:
      - cefiro_data:/app/uploads
    environment:
      AUTH_URL: http://localhost:3000
      DATABASE_URL: postgres://postgres:cefiro@db:5432/cefiro
      MASTER_KEY: <32-byte-base64-key> # openssl rand -base64 32
      OBSCURA_ENDPOINT: ws://obscura:9222
      REDIS_URL: redis://redis:6379
      UPLOADS_DIR: /app/uploads
    healthcheck:
      test:
        [
          "CMD-SHELL",
          'node -e "require(''http'').get(''http://localhost:3000/api/v1/health'', r => process.exit(r.statusCode===200?0:1))"',
        ]
      interval: 1m
      timeout: 15s
      retries: 3
      start_period: 1m
    depends_on:
      - db
      - redis

  db:
    image: postgres:17-alpine
    container_name: cefiro-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: cefiro
      POSTGRES_DB: cefiro
    volumes:
      - db_data:/var/lib/postgresql/data

  # Renders recipe pages for URL imports
  obscura:
    image: norishapp/obscura:0.2.0-norish.1
    container_name: cefiro-obscura
    restart: unless-stopped

  redis:
    image: redis:8.4.0
    container_name: cefiro-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  db_data:
  cefiro_data:
  redis_data:
```

## Sites running Cefiro

Public instances built on Cefiro:

- 🇸🇰 **[nasakuchyna.sk](https://nasakuchyna.sk)** — Naša Kuchyňa, a Slovak recipe-sharing community.
- **[cefiro.spertulo.sk](https://cefiro.spertulo.sk)** — the reference/demo instance.

Running a public Cefiro instance? Open a PR adding it here.

## Development

This is a pnpm + Turborepo monorepo (Next.js App Router, tRPC, Drizzle/Postgres, next-intl across 15 locales). See [CONTRIBUTING.md](CONTRIBUTING.md) and, for the shared foundation, the upstream [development docs](https://docs.norish.dev/development/setup).

## Built on Norish

Cefiro would not exist without **[Norish](https://norish.dev)** by the Norish authors — the entire real-time, household-first recipe engine underneath the discovery and cooking layers is theirs. Please support the upstream project:

- Website: [norish.dev](https://norish.dev) · Docs: [docs.norish.dev](https://docs.norish.dev)
- Source: [github.com/norish-recipes/Norish](https://github.com/norish-recipes/Norish)

Both Norish and Cefiro are licensed under [AGPL-3.0](LICENSE); this fork preserves that license and its network-use obligations.

## License

[AGPL-3.0](LICENSE) — a copyleft license: if you run a modified version as a network service, you must offer users the corresponding source.
