import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

import { DEFAULT_YT_DLP_VERSION } from "./zod/server-config";

// Import server-only to ensure this file is only used on the server
// Using dynamic import wrapped in IIFE for compatibility
(async () => {
  try {
    if (
      process.env.NEXT_RUNTIME ||
      process.env.__NEXT_PRIVATE_ORIGINAL_ENV ||
      process.env.NEXT_PHASE
    ) {
      await import("server-only");
    }
  } catch {
    // server-only import may fail during build or non-server contexts, this is expected
    // Silently ignore - this runs before logger is initialized
  }
})();

const envFiles =
  process.env.NODE_ENV === "production" ? [".env.production", ".env.local"] : [".env.local"];

function findEnvPath(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    for (const envFile of envFiles) {
      const candidate = path.resolve(currentDir, envFile);

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

const envPath = findEnvPath(process.cwd());

const defaultRuntimeRoot = path.resolve("./.runtime");
const defaultUploadsDir =
  process.env.NODE_ENV === "production" ? "/app/uploads" : path.join(defaultRuntimeRoot, "uploads");
const defaultYtDlpBinDir =
  process.env.NODE_ENV === "production" ? "/app/bin" : path.join(defaultRuntimeRoot, "bin");

if (envPath) {
  config({ path: envPath, quiet: true });
}

// ---------------------------------------------------------------------------
// Component-based DATABASE_URL fallback: if DATABASE_URL is not provided,
// assemble it from optional DATABASE_PORT, DATABASE, DATABASE_USER,
// DATABASE_PASSWORD values and sane defaults.
// ---------------------------------------------------------------------------
if (!process.env.DATABASE_URL) {
  const host = process.env.DATABASE_HOST ?? "localhost";
  const port = process.env.DATABASE_PORT ?? "5432";
  const db = process.env.DATABASE ?? "norish";
  const user = process.env.DATABASE_USER ?? "postgres";
  const password = process.env.DATABASE_PASSWORD ?? "norish";
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;

  process.env.DATABASE_URL = `postgresql://${credentials}@${host}:${port}/${db}`;
}

const isBuild =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.VITEST === "true" ||
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export";

const ServerConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]),

  // Local server binding
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(3000),
  // Public URL for auth callbacks etc.
  AUTH_URL: z.url().default("http://localhost:3000"),
  // Additional trusted origins (comma-separated URLs) for multi-domain access
  TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
    .pipe(z.array(z.string())),
  UPLOADS_DIR: z.string().default(defaultUploadsDir),

  // Media storage backend. "fs" (default) keeps uploads on the local
  // UPLOADS_DIR volume — the self-hosted default, unchanged. "s3" stores every
  // image and video in an S3-compatible bucket instead, so no persistent volume
  // is needed; the app still proxies the bytes through its own media routes, so
  // stored URLs (and therefore the DB, OG images and crawlers) are identical
  // either way. The S3_* values are required only when STORAGE_DRIVER is "s3"
  // (validated at client init, not here, so an fs instance needs none of them).
  STORAGE_DRIVER: z.enum(["fs", "s3"]).default("fs"),
  // e.g. "https://s3.eu-central-1.amazonaws.com", "http://minio:9000",
  // "https://<account>.r2.cloudflarestorage.com". Host[:port] also accepted.
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Most self-hosted S3-compatible stores (MinIO, R2, B2) need path-style URLs
  // (bucket in the path, not the host); real AWS S3 wants virtual-host style.
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((val) => val !== "false" && val !== "0")
    .pipe(z.boolean())
    .default(true),
  // Optional key prefix inside the bucket, so one bucket can hold several
  // environments (e.g. "cefiro-prod"). No leading slash; a trailing slash is
  // optional. Empty by default (objects sit at the bucket root).
  S3_PREFIX: z.string().default(""),

  // Auth endpoint rate limiting. Defaults are the production values; they are
  // overridable so a harness driving many sessions against one server (the
  // browser E2E stack reuses a single server across a whole project) is not
  // throttled into failures that say nothing about the code under test.
  AUTH_RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  AUTH_RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // During build, allow placeholder DB URL so server-only modules can be imported
  // without requiring runtime secrets. Runtime still enforces a real URL.
  DATABASE_URL: isBuild
    ? z.url().default("postgresql://build:build@localhost:5432/build")
    : z.url(),

  ENABLE_REGISTRATION: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),

  AI_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),

  OIDC_NAME: z.string().default("Nora ID"),
  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_WELLKNOWN: z.string().optional(),
  // OIDC Claim Mapping
  OIDC_CLAIM_MAPPING_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),
  OIDC_SCOPES: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
    .pipe(z.array(z.string())),
  OIDC_GROUPS_CLAIM: z.string().default("groups"),
  OIDC_ADMIN_GROUP: z.string().default("norish_admin"),
  OIDC_HOUSEHOLD_GROUP_PREFIX: z.string().default("norish_household_"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email (SMTP) — all optional. Sending is enabled only when SMTP_HOST and
  // EMAIL_FROM are both set; otherwise the mailer is a no-op and features that
  // would email (e.g. household invites) fall back to a shareable link.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // STARTTLS on 587 (secure=false) is the common default; set true for 465.
  SMTP_SECURE: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // The From header, e.g. `Cefiro <no-reply@cefiro.example.com>`.
  EMAIL_FROM: z.string().optional(),

  // Billing (Stripe) — all optional. Entitlement gating is active ONLY when
  // BILLING_ENABLED is true; otherwise every user is treated as unlimited (the
  // self-hosted default), so the app is never degraded without billing set up.
  BILLING_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Stripe Price IDs for the paid plans (used by checkout + webhook mapping).
  STRIPE_PRICE_PLUS: z.string().optional(),
  STRIPE_PRICE_FAMILY: z.string().optional(),

  // During build (SKIP_ENV_VALIDATION=1), use a placeholder key for Next.js compilation
  // At runtime, require a real 32+ char key - the placeholder is never persisted in the image
  MASTER_KEY: isBuild
    ? z.string().default("QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=")
    : z.string().min(32),

  // AI Provider Configuration
  AI_PROVIDER: z.enum(["openai", "ollama", "lm-studio", "generic-openai"]).default("openai"),
  AI_ENDPOINT: z.string().optional(),
  AI_MODEL: z.string().default("gpt-5-mini"),
  AI_API_KEY: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(1.0),
  AI_MAX_TOKENS: z.coerce.number().default(10000),
  AI_TIMEOUT_MS: z.coerce.number().default(300000),

  // Video Processing Configuration
  VIDEO_PARSING_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .pipe(z.boolean())
    .default(false),
  VIDEO_MAX_LENGTH_SECONDS: z.coerce.number().default(120),
  YT_DLP_PROXY: z.string().optional(),
  YT_DLP_VERSION: z.string().default(DEFAULT_YT_DLP_VERSION),
  YT_DLP_BIN_DIR: z.string().default(defaultYtDlpBinDir),

  // Transcription Configuration (separate from AI_PROVIDER)
  TRANSCRIPTION_PROVIDER: z
    .enum(["openai", "ollama", "lm-studio", "generic-openai", "disabled"])
    .default("disabled"),
  TRANSCRIPTION_ENDPOINT: z.string().optional(), // Required for local providers
  TRANSCRIPTION_API_KEY: z.string().optional(), // Can use AI_API_KEY if not set
  TRANSCRIPTION_MODEL: z.string().default("whisper-1"),

  UNITS_JSON: z.string().optional(),
  CONTENT_INDICATORS: z.string().optional(),
  CONTENT_INGREDIENTS: z.string().optional(),

  // The Obscura CDP server that renders pages for URL imports. Not necessarily
  // a raw browser WebSocket URL — it is whatever Playwright's CDP connection
  // accepts, which the shipped `obscura` service answers on its default port.
  OBSCURA_ENDPOINT: z
    .string()
    .min(1, "OBSCURA_ENDPOINT is required for web scraping")
    .default("ws://obscura:9222"),

  PARSER_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Scheduler Configuration
  SCHEDULER_CLEANUP_MONTHS: z.coerce.number().default(3),

  // File Size Limits (in bytes)
  MAX_AVATAR_FILE_SIZE: z.coerce.number().default(5 * 1024 * 1024), // 5MB
  MAX_IMAGE_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  MAX_VIDEO_FILE_SIZE: z.coerce.number().default(100 * 1024 * 1024), // 100MB

  // Redis Configuration
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // Internationalization
  // If invalid locale is specified, falls back to 'en'
  DEFAULT_LOCALE: z.string().default("en"),
  // If not set, all available locales are enabled
  // Can be overridden by admin UI settings stored in database
  ENABLED_LOCALES: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
    .pipe(z.array(z.string())),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export const INTERNAL_PARSER_API_HOST = "127.0.0.1";
export const INTERNAL_PARSER_API_PORT = 8001;
export const INTERNAL_PARSER_API_URL = `http://${INTERNAL_PARSER_API_HOST}:${INTERNAL_PARSER_API_PORT}`;

export function buildInternalParserApiUrl(pathname: string): string {
  return new URL(pathname, INTERNAL_PARSER_API_URL).toString();
}

let configInstance: ServerConfig | null = null;

export function initializeServerConfig(): ServerConfig {
  if (configInstance) return configInstance;
  configInstance = ServerConfigSchema.parse(process.env);

  return configInstance;
}

export const SERVER_CONFIG = initializeServerConfig();
