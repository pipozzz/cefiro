# Deploying Cefiro on Nomad

`cefiro.nomad.hcl` runs the app image published by the CI workflow
(`ghcr.io/pipozzz/cefiro`) together with PostgreSQL, Redis and Obscura.

## Prerequisites

- A Nomad cluster with the **Docker** driver, and **Consul** if you want the
  Traefik service tags / `provider = "consul"` health registration.
- A reverse proxy terminating TLS for your domain (Traefik assumed; the router
  tags in the job are a starting point).

## 1. Access to the image

The repo is private, so its GHCR package is private too. Pick one:

- **Simplest — make the package public:** GitHub → repo → Packages → `cefiro`
  → Package settings → Change visibility → Public. Then delete the `auth {}`
  block in the `web` task; no token needed.
- **Keep it private:** create a token with `read:packages` (a fine-grained PAT
  or classic token) and pass it as `registry_password` (see below).

## 2. Host volumes

Declare two host volumes on each eligible Nomad client (in the client's Nomad
config), then restart the client:

```hcl
client {
  host_volume "cefiro_pgdata"  { path = "/opt/cefiro/pgdata"  read_only = false }
  host_volume "cefiro_uploads" { path = "/opt/cefiro/uploads" read_only = false }
}
```

Using an **external Postgres/Redis** instead? Delete the `postgres` / `redis`
tasks (and the `pgdata` volume), and set `DATABASE_URL` / `REDIS_URL` in the
`web` task to point at them.

## 3. Secrets (Nomad Variables)

The job reads secrets from the Nomad Variable at path `nomad/jobs/cefiro`:

```bash
# MASTER_KEY derives the PII encryption keys — generate ONCE and keep it forever.
nomad var put nomad/jobs/cefiro \
  master_key="$(openssl rand -base64 32)" \
  postgres_password="$(openssl rand -base64 24 | tr -d '/+=')" \
  password_auth_enabled="true"
```

> ⚠️ Never change `master_key` after first launch — existing encrypted
> email/name/avatar data would become unreadable.

For an OIDC/GitHub/Google provider instead of password auth, set
`password_auth_enabled="false"` and add the provider's env vars to the `web`
task's template (see `.env.example` in the repo root for the full list).

## 4. Deploy

```bash
nomad job run \
  -var domain=recipes.example.com \
  -var image_tag=latest \
  -var registry_password=<GHCR_PAT_or_empty_if_public> \
  deploy/nomad/cefiro.nomad.hcl
```

Pin a specific build instead of `latest` by passing a short SHA or a `vX.Y.Z`
tag as `image_tag` (the CI workflow publishes all three).

## 5. Verify

```bash
nomad job status cefiro
nomad alloc logs -job cefiro web        # expect "Migrations complete" then "Server ready"
curl -sf https://recipes.example.com/api/v1/health
```

On first load the app runs the first-user setup (password auth) — the first
account becomes the server owner.

## Continuous deploy (GitHub Actions → Nomad)

The `Build & push Docker image` workflow has a `deploy` job that runs
`nomad job run` after the image is pushed. It is **skipped** until you opt in.

1. In **Settings → Secrets and variables → Actions**, add:
   - **Variables:** `DEPLOY_ENABLED=true`, `CEFIRO_DOMAIN=recipes.example.com`
   - **Secrets:** `NOMAD_ADDR` (e.g. `https://nomad.internal:4646`),
     `NOMAD_TOKEN` (an ACL token that can submit the job), and `GHCR_TOKEN`
     (a `read:packages` token — omit if the package is public).
2. Make sure the runner can **reach `NOMAD_ADDR`**. GitHub-hosted runners only
   see it if it is publicly reachable. For a private Nomad, either:
   - use a **self-hosted runner** on your network (change `runs-on` in the
     `deploy` job), or
   - uncomment the **Tailscale** step in the workflow and set the
     `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` secrets.
3. Optionally protect the `production` GitHub Environment with required
   reviewers so each deploy needs approval.

The job deploys the exact image just built (`image_tag=sha-<short>`). Nomad's
own rolling `update {}` + health check gate the rollout and auto-revert on
failure.

## Notes

- Migrations run automatically on container start (`runMigrations`).
- The app trusts `X-Forwarded-Host`/`-Proto`, so OG `og:image` URLs resolve to
  your real domain behind the proxy — make sure Traefik forwards those headers.
- Continuous deploy: have your pipeline run `nomad job run` (or bump `image_tag`)
  after the `Build & push Docker image` workflow publishes a new tag.
