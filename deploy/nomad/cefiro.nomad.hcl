# Cefiro — Nomad job spec
# ---------------------------------------------------------------------------
# Runs the Cefiro web app plus its dependencies (PostgreSQL, Redis, Obscura)
# in a single group, so the app reaches them over localhost (bridge network).
# The app applies its own DB migrations on startup.
#
# Quick start:
#   1. Put secrets in a Nomad Variable at path "nomad/jobs/cefiro" (see README).
#   2. Declare the two host volumes on your Nomad client(s) (see README).
#   3. Either make the ghcr.io/pipozzz/cefiro package public and delete the
#      `auth` block in the web task, OR pass a read:packages token:
#        nomad job run -var registry_password=<GHCR_PAT> \
#                      -var domain=recipes.example.com cefiro.nomad.hcl
#
# Production hardening (see README): split Postgres/Redis into their own groups
# (or point DATABASE_URL/REDIS_URL at managed instances and delete those tasks),
# and use CSI/managed volumes instead of host volumes.

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "ghcr.io/pipozzz/cefiro image tag to run (latest, a short sha, or vX.Y.Z)."
}

variable "domain" {
  type        = string
  default     = "cefiro.example.com"
  description = "Public hostname the app is served on. Sets AUTH_URL and the Traefik router rule."
}

variable "registry_password" {
  type        = string
  default     = ""
  description = "GHCR token with read:packages. Leave empty if the package is public (then also remove the auth block)."
}

variable "datacenters" {
  type    = list(string)
  default = ["dc1"]
}

job "cefiro" {
  datacenters = var.datacenters
  type        = "service"

  update {
    max_parallel     = 1
    min_healthy_time = "20s"
    healthy_deadline = "5m"
    auto_revert      = true
  }

  group "cefiro" {
    count = 1

    network {
      mode = "bridge"
      port "web" {
        to = 3000
      }
    }

    # Host volumes must be declared on the Nomad client, e.g.:
    #   client { host_volume "cefiro_pgdata"  { path = "/opt/cefiro/pgdata" } }
    #   client { host_volume "cefiro_uploads" { path = "/opt/cefiro/uploads" } }
    volume "pgdata" {
      type      = "host"
      source    = "cefiro_pgdata"
      read_only = false
    }

    volume "uploads" {
      type      = "host"
      source    = "cefiro_uploads"
      read_only = false
    }

    # Sessions live in Redis, so its data must outlast a redeploy or everyone
    # gets logged out. Declare `cefiro_redis` on the client like the others.
    volume "redisdata" {
      type      = "host"
      source    = "cefiro_redis"
      read_only = false
    }

    # Tasks in a group start together; the web task retries until Postgres,
    # Redis and Obscura are reachable.
    restart {
      attempts = 6
      interval = "10m"
      delay    = "15s"
      mode     = "delay"
    }

    # --- PostgreSQL (delete this task if you use an external database) ------
    task "postgres" {
      driver = "docker"

      config {
        image = "postgres:17-alpine"
      }

      volume_mount {
        volume      = "pgdata"
        destination = "/var/lib/postgresql/data"
      }

      env {
        POSTGRES_USER = "postgres"
        POSTGRES_DB   = "cefiro"
        PGDATA        = "/var/lib/postgresql/data/pgdata"
      }

      template {
        destination = "secrets/postgres.env"
        env         = true
        data        = <<-EOH
        POSTGRES_PASSWORD={{ with nomadVar "nomad/jobs/cefiro" }}{{ .postgres_password }}{{ end }}
        EOH
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }

    # --- Redis (delete this task if you use an external Redis) --------------
    task "redis" {
      driver = "docker"

      config {
        image   = "redis:8.10.1"
        command = "redis-server"
        # AOF on + a persistent volume so sessions (better-auth secondaryStorage)
        # survive a redeploy. Without this, every deploy logs all users out.
        args    = ["--appendonly", "yes", "--dir", "/data"]
      }

      volume_mount {
        volume      = "redisdata"
        destination = "/data"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    # --- Obscura (headless renderer used for URL recipe imports) ------------
    task "obscura" {
      driver = "docker"

      config {
        image = "norishapp/obscura:0.2.0-norish.1"
      }

      resources {
        cpu    = 300
        memory = 512
      }
    }

    # --- Cefiro web app (main workload) ------------------------------------
    task "web" {
      driver = "docker"

      config {
        image = "ghcr.io/pipozzz/cefiro:${var.image_tag}"
        ports = ["web"]

        # Remove this block if the GHCR package is public.
        auth {
          username = "pipozzz"
          password = var.registry_password
        }
      }

      volume_mount {
        volume      = "uploads"
        destination = "/app/uploads"
      }

      env {
        NODE_ENV = "production"
        AUTH_URL = "https://${var.domain}"
        # Same-group tasks share the network namespace → reach them on localhost.
        REDIS_URL        = "redis://localhost:6379"
        OBSCURA_ENDPOINT = "ws://localhost:9222"
        UPLOADS_DIR      = "/app/uploads"
        TRUSTED_ORIGINS  = "https://${var.domain}"
      }

      # Secrets from the Nomad Variable "nomad/jobs/cefiro".
      # MASTER_KEY derives the PII encryption keys — set it once and never change
      # it, or existing encrypted data becomes unreadable.
      template {
        destination = "secrets/web.env"
        env         = true
        data        = <<-EOH
        {{ with nomadVar "nomad/jobs/cefiro" -}}
        MASTER_KEY={{ .master_key }}
        DATABASE_URL=postgres://postgres:{{ .postgres_password }}@localhost:5432/cefiro
        PASSWORD_AUTH_ENABLED={{ .password_auth_enabled }}
        {{ if .smtp_host }}SMTP_HOST={{ .smtp_host }}{{ end }}
        {{ if .smtp_port }}SMTP_PORT={{ .smtp_port }}{{ end }}
        {{ if .smtp_secure }}SMTP_SECURE={{ .smtp_secure }}{{ end }}
        {{ if .smtp_user }}SMTP_USER={{ .smtp_user }}{{ end }}
        {{ if .smtp_password }}SMTP_PASSWORD={{ .smtp_password }}{{ end }}
        {{ if .email_from }}EMAIL_FROM={{ .email_from }}{{ end }}
        {{- end }}
        EOH
      }

      resources {
        cpu    = 1000
        memory = 1024
      }
    }

    # Service registration + health check. The Traefik tags assume a Consul +
    # Traefik setup; drop them if you route another way.
    service {
      name     = "cefiro"
      port     = "web"
      provider = "consul"

      tags = [
        "traefik.enable=true",
        "traefik.http.routers.cefiro.rule=Host(`${var.domain}`)",
        "traefik.http.routers.cefiro.entrypoints=websecure",
        "traefik.http.routers.cefiro.tls=true",
        "traefik.http.routers.cefiro.tls.certresolver=letsencrypt",
      ]

      check {
        name     = "http-health"
        type     = "http"
        path     = "/api/v1/health"
        interval = "15s"
        timeout  = "3s"

        check_restart {
          limit = 3
          grace = "60s"
        }
      }
    }
  }
}
