import fs from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { serverLogger as log } from "@norish/shared-server/logger";

/**
 * Verify the uploads directory is writable at startup.
 *
 * Image uploads and recipe-photo imports write under `UPLOADS_DIR`, and every
 * such write swallows its own error and moves on — so when the directory is not
 * writable (typically a mounted host volume owned by a different uid than the
 * container user) recipes import with no photo and avatars fail to save, with
 * no obvious cause. This surfaces that as a single, loud line at boot with the
 * exact fix, instead of a scatter of per-request failures.
 *
 * Non-fatal: the rest of the app still works, so we log and continue rather
 * than refuse to start.
 */
export async function checkUploadsWritable(): Promise<void> {
  if (SERVER_CONFIG.STORAGE_DRIVER === "s3") {
    log.info("S3 storage — skipping local uploads writable check");

    return;
  }

  const dir = SERVER_CONFIG.UPLOADS_DIR;
  const uid = typeof process.getuid === "function" ? process.getuid() : "unknown";

  try {
    await fs.mkdir(dir, { recursive: true });

    const probe = path.join(dir, `.write-probe-${process.pid}`);

    await fs.writeFile(probe, "ok");
    await fs.rm(probe, { force: true });

    log.info({ dir }, "Uploads directory is writable");
  } catch (err) {
    log.error(
      { err, dir, uid },
      `Uploads directory "${dir}" is NOT writable — image uploads and recipe photo ` +
        `imports will fail silently. If this is a mounted host volume, chown it to ` +
        `the container user (uid ${uid}) on the host: chown -R ${uid}:${uid} <host path>`
    );
  }
}
