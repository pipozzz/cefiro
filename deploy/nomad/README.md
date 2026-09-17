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
  host_volume "cefiro_redis"   { path = "/opt/cefiro/redis"   read_only = false }
}
```

**Why a Redis volume?** Login sessions live in Redis (better-auth
secondaryStorage). All tasks in the group restart together on a redeploy, so
without a persistent Redis volume + AOF every deploy logs all users out. The job
enables `--appendonly yes` and mounts this volume at `/data`.

**Ownership matters.** The `web` container runs as a non-root user (**uid 1000**
by default), and a mounted host volume keeps the host directory's ownership —
shadowing the writable dir baked into the image. If `/opt/cefiro/uploads` is
owned by root, recipe-photo imports and avatar uploads fail with
`EACCES: permission denied, mkdir '/app/uploads/recipes'` (the server also warns
about this at startup). Chown the host directory to the container user once:

```bash
sudo mkdir -p /opt/cefiro/uploads
sudo chown -R 1000:1000 /opt/cefiro/uploads
```

(Use the image's `UID` build arg value if you overrode the default.)

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

### Email (optional)

To send transactional mail (household invites, etc.), add SMTP keys to the
same Nomad Variable. They're all optional; sending turns on only when both
`smtp_host` and `email_from` are set — otherwise those features fall back to a
copyable link. Works with any SMTP provider (your own server, Fastmail,
Mailgun, a Gmail app-password, …).

```bash
nomad var put nomad/jobs/cefiro \
  master_key="…" postgres_password="…" password_auth_enabled="true" \
  smtp_host="smtp.example.com" \
  smtp_port="587" \
  smtp_secure="false" \
  smtp_user="postmaster@example.com" \
  smtp_password="…" \
  email_from="Cefiro <no-reply@example.com>"
```

> `smtp_port` 587 with `smtp_secure="false"` is STARTTLS (the common default);
> use 465 with `smtp_secure="true"` for implicit TLS. Set up SPF/DKIM for your
> `email_from` domain so mail isn't flagged as spam.

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

## Deployment (pull-based, via nomploy)

GitHub does **not** connect to Nomad. The pipeline only builds and publishes
`ghcr.io/pipozzz/cefiro:latest`; deployment is pull-based through the **nomploy**
UI (nomploy.spertulo.sk), which runs the service on Nomad and pulls the image.

This job spec is the source of truth for the service to create there — either
paste the HCL if nomploy accepts a raw jobspec, or fill the equivalent fields:

| Field | Value |
|---|---|
| Image | `ghcr.io/pipozzz/cefiro:latest` |
| Port | container `3000` |
| Health check | HTTP `GET /api/v1/health` |
| Env | `AUTH_URL=https://<domain>`, `REDIS_URL`, `OBSCURA_ENDPOINT`, `UPLOADS_DIR=/app/uploads`, `TRUSTED_ORIGINS` |
| Secrets | `MASTER_KEY`, `DATABASE_URL` (see §3) |
| Volumes | `/app/uploads`, plus Postgres data if you co-locate the DB |
| Dependencies | Postgres, Redis, Obscura (co-located here, or external) |

**Make the GHCR package public** (repo → Packages → `cefiro` → Change
visibility → Public) so nomploy/Nomad can pull it without registry
credentials — otherwise configure a GHCR pull token on the Nomad clients.

New images: each push to `main` publishes a fresh `latest` (and `sha-<short>`);
redeploy from nomploy (or point it at an immutable `sha-<short>` tag to pin).

## Notes

- Migrations run automatically on container start (`runMigrations`).
- The app trusts `X-Forwarded-Host`/`-Proto`, so OG `og:image` URLs resolve to
  your real domain behind the proxy — make sure Traefik forwards those headers.
- Continuous deploy: have your pipeline run `nomad job run` (or bump `image_tag`)
  after the `Build & push Docker image` workflow publishes a new tag.
