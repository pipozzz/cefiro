/* eslint-disable no-console -- one-off operator CLI; plain stdout is the point */
/**
 * Copy every media file from the local UPLOADS_DIR into the configured
 * S3/R2 bucket, using the app's own object store so keys and S3_PREFIX match
 * exactly what the running app reads back.
 *
 * Run this ONCE after switching STORAGE_DRIVER=s3 (with the S3_* vars set), so
 * images/videos uploaded while on the filesystem driver keep working. New
 * uploads already go straight to the bucket.
 *
 * Usage (on the host where UPLOADS_DIR lives, with the S3_* env set):
 *   pnpm --filter @norish/web exec tsx scripts/migrate-media-to-s3.ts
 * Flags (env):
 *   DRY_RUN=1   list what would be copied, write nothing
 *   FORCE=1     re-upload even objects already present in the bucket
 *
 * Idempotent: existing objects are skipped unless FORCE=1. Non-destructive:
 * nothing is deleted from the local disk — remove it yourself once verified.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getObjectStore } from "@norish/shared-server/media/object-store";

const EXT_CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
};

function contentTypeForKey(key: string): string {
  return EXT_CONTENT_TYPE[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

/** Every file path under `dir`, recursively. */
async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const force = process.env.FORCE === "1" || process.env.FORCE === "true";

  if (SERVER_CONFIG.STORAGE_DRIVER !== "s3") {
    console.error(
      "STORAGE_DRIVER is not 's3'. Set STORAGE_DRIVER=s3 and the S3_* vars before migrating."
    );
    process.exit(1);
  }

  const root = SERVER_CONFIG.UPLOADS_DIR;

  try {
    await fs.access(root);
  } catch {
    console.error(`UPLOADS_DIR not found: ${root} — nothing to migrate.`);
    process.exit(1);
  }

  const store = getObjectStore();

  console.log(
    `Migrating media from ${root} → bucket ${SERVER_CONFIG.S3_BUCKET}` +
      (SERVER_CONFIG.S3_PREFIX ? ` (prefix "${SERVER_CONFIG.S3_PREFIX}")` : "") +
      (dryRun ? " [DRY RUN]" : "")
  );

  let total = 0;
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for await (const file of walk(root)) {
    total += 1;
    // Key is the POSIX path relative to the uploads root — exactly the tail of
    // the stored web URL, which is what the object store addresses by.
    const key = path.relative(root, file).split(path.sep).join("/");

    try {
      if (!force && (await store.exists(key))) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`would copy: ${key}`);
        copied += 1;
        continue;
      }

      const bytes = await fs.readFile(file);

      await store.put(key, bytes, contentTypeForKey(key));
      copied += 1;

      if (copied % 25 === 0) {
        console.log(`…copied ${copied}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${key}: ${(err as Error).message}`);
    }
  }

  console.log(
    `Done. scanned=${total} ${dryRun ? "would-copy" : "copied"}=${copied} skipped=${skipped} failed=${failed}`
  );
  process.exit(failed > 0 ? 1 : 0);
}

void main();
