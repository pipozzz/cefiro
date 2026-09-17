#!/usr/bin/env node
/**
 * One-off migration: upload an existing local uploads volume into an
 * S3-compatible bucket, using the SAME object keys the app serves from, so
 * after `STORAGE_DRIVER=s3` every stored URL keeps resolving unchanged.
 *
 * It reads files from UPLOADS_DIR and writes them under the same relative path
 * (optionally beneath S3_PREFIX). Existing objects are skipped unless
 * OVERWRITE=1. Nothing is deleted from the local disk — verify first, then
 * unmount the volume yourself.
 *
 * Usage (from the repo root, with the S3_* env vars set the same way the app
 * will run):
 *
 *   UPLOADS_DIR=/app/uploads \
 *   S3_ENDPOINT=... S3_REGION=... S3_BUCKET=... \
 *   S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
 *   node packages/shared-server/scripts/migrate-uploads-to-s3.mjs
 *
 *   # preview without uploading
 *   DRY_RUN=1 node packages/shared-server/scripts/migrate-uploads-to-s3.mjs
 */
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";
const PREFIX = (process.env.S3_PREFIX || "").replace(/^\/+|\/+$/g, "");
const BUCKET = requireEnv("S3_BUCKET");
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const OVERWRITE = process.env.OVERWRITE === "1" || process.env.OVERWRITE === "true";

const CONTENT_TYPES = {
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

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }

  return value;
}

function contentType(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function endpoint() {
  const raw = requireEnv("S3_ENDPOINT");

  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

const client = new S3Client({
  endpoint: endpoint(),
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle:
    process.env.S3_FORCE_PATH_STYLE !== "false" && process.env.S3_FORCE_PATH_STYLE !== "0",
  credentials: {
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
  },
});

/** Yield every file path under `dir`, recursively. */
async function* walk(dir) {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function objectExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = path.resolve(UPLOADS_DIR);

  console.log(
    `Migrating ${root} -> s3://${BUCKET}${PREFIX ? `/${PREFIX}` : ""}` +
      `${DRY_RUN ? " (dry run)" : ""}`
  );

  let uploaded = 0;
  let skipped = 0;
  let bytes = 0;

  for await (const file of walk(root)) {
    // Key = path relative to the uploads root, POSIX-style; the same tail the
    // app's media URLs carry (recipes/{id}/{file}, avatars/{file}, ...).
    const relative = path.relative(root, file).split(path.sep).join("/");
    const key = PREFIX ? `${PREFIX}/${relative}` : relative;

    if (!OVERWRITE && (await objectExists(key))) {
      skipped++;
      continue;
    }

    const { size } = await stat(file);

    if (DRY_RUN) {
      console.log(`would upload ${relative} (${size} bytes)`);
      uploaded++;
      bytes += size;
      continue;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: createReadStream(file),
        ContentLength: size,
        ContentType: contentType(file),
      })
    );

    uploaded++;
    bytes += size;

    if (uploaded % 100 === 0) {
      console.log(`  ${uploaded} uploaded...`);
    }
  }

  console.log(
    `Done. ${uploaded} ${DRY_RUN ? "to upload" : "uploaded"}, ${skipped} skipped ` +
      `(already present), ${(bytes / 1024 / 1024).toFixed(1)} MiB.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
