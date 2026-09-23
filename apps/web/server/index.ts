import { initCaldavSync } from "@norish/api/caldav/event-listener";
import { initRecipeEnrichmentListener } from "@norish/api/recipes/enrichment-listener";
import { backfillDishColors } from "@norish/api/startup/backfill-dish-color";
import { checkUploadsWritable } from "@norish/api/startup/check-uploads-writable";
import { createServer } from "@norish/api/startup/http-server";
import { runStartupMaintenanceCleanup } from "@norish/api/startup/maintenance-cleanup";
import { migrateGalleryImages } from "@norish/api/startup/migrate-gallery-images";
import { runMigrations } from "@norish/api/startup/migrations";
import { registerApiHandlersForQueue } from "@norish/api/startup/register-queue-api-handlers";
import { seedServerConfig } from "@norish/api/startup/seed-config";
import { seedDemoRecipes } from "@norish/api/startup/seed-demo-recipes";
import { registerShutdownHandlers } from "@norish/api/startup/shutdown";
import { initializeVideoProcessing } from "@norish/api/startup/video-processing";
import { initializeServerConfig, SERVER_CONFIG } from "@norish/config/env-config-server";
import { initializeQueues } from "@norish/queue/registry";
import { startWorkers } from "@norish/queue/start-workers";
import { serverLogger as log, redactUrl } from "@norish/shared-server/logger";

import { startEmbeddedParser } from "./embedded-parser";

/**
 * Process role, so HTTP serving and background work can run in separate
 * containers instead of contending for one Node event loop / CPU:
 *
 *   all    (default) — one process does both; the self-hosted single-container
 *                      deploy is unchanged.
 *   web              — HTTP server + client-facing real-time listeners only;
 *                      no queues, CalDAV sync, video transcode or importer.
 *   worker           — background jobs only (queues, CalDAV, video, importer);
 *                      no HTTP server.
 *
 * Splitting matters because a CPU-heavy job (sharp, ffmpeg, an AI import) on
 * the same process blocks every HTTP request until it finishes.
 */
const ROLE = (process.env.CEFIRO_ROLE ?? "all").toLowerCase();
const RUNS_WEB = ROLE === "web" || ROLE === "all";
const RUNS_WORKERS = ROLE === "worker" || ROLE === "all";

async function main() {
  const config = initializeServerConfig();

  log.info("-".repeat(50));
  log.info("Server configuration loaded:");
  log.info(`  Role: ${ROLE} (web=${RUNS_WEB}, workers=${RUNS_WORKERS})`);
  log.info(`  Environment: ${config.NODE_ENV}`);
  log.info(`  Database: ${redactUrl(config.DATABASE_URL)}`);
  log.info(`  Auth URL: ${config.AUTH_URL}`);
  log.info(`  Upload dir: ${config.UPLOADS_DIR}`);
  log.info("-".repeat(50));

  // Both roles read/write media (the web serves it and writes avatars; the
  // worker writes imported/generated images), so both need a writable store.
  await checkUploadsWritable();
  log.info("-".repeat(50));

  // One-time, leader-only startup: schema migrations, config seeding and the
  // data backfills. The web role is the leader; a worker-only process assumes
  // the web has already run these (there is always a web task), which also
  // avoids two processes racing the migrator.
  if (RUNS_WEB) {
    await runMigrations();
    log.info("-".repeat(50));

    await seedServerConfig();
    log.info("-".repeat(50));

    // Cold-start only (SEED_DEMO_RECIPES): a curated set of public recipes so a
    // fresh instance has something for discovery and search. No-op otherwise.
    await seedDemoRecipes();
    log.info("-".repeat(50));

    await migrateGalleryImages();
    log.info("-".repeat(50));

    // After the gallery migration, so every image URL it rewrites is already
    // in the canonical shape the extractor resolves.
    await backfillDishColors();
    log.info("-".repeat(50));

    await runStartupMaintenanceCleanup();
    log.info("-".repeat(50));
  }

  // Registration + the queue registry are needed on both sides — the web
  // enqueues jobs, the worker processes them — and are cheap and idempotent.
  registerApiHandlersForQueue();
  await initializeQueues();
  log.info("-".repeat(50));

  // Background processing lives in the worker role: the queues, the CalDAV sync
  // service, video transcode, and the embedded parser the import worker calls.
  let embeddedParser: Awaited<ReturnType<typeof startEmbeddedParser>> = null;

  if (RUNS_WORKERS) {
    embeddedParser = await startEmbeddedParser(config);

    await initializeVideoProcessing();
    log.info("-".repeat(50));

    initCaldavSync();
    log.info("CalDAV sync service initialized");
    log.info("-".repeat(50));

    await startWorkers();
    log.info("-".repeat(50));
  }

  const shutdownTasks = embeddedParser
    ? [{ name: "Stop embedded parser", run: embeddedParser.stop }]
    : [];

  if (RUNS_WEB) {
    // The recipe-enrichment listener pushes to connected clients, so it belongs
    // with the HTTP server. Subscribe before serving so a just-produced recipe
    // is never announced to a listener that isn't up yet.
    await initRecipeEnrichmentListener();
    log.info("-".repeat(50));

    const { server, hostname, port } = await createServer();

    registerShutdownHandlers(server, shutdownTasks);

    server.listen(port, hostname, () => {
      log.info("-".repeat(50));
      log.info("Server ready:");
      log.info(`  HTTP: http://${hostname}:${port}`);
      log.info(`  WS:   ws://${hostname}:${port}/ws`);
      log.info(`  ENV:  ${SERVER_CONFIG.NODE_ENV}`);
      log.info("-".repeat(50));
    });
  } else {
    // Worker-only: no HTTP server, but still drain workers, the parser and
    // Redis on SIGTERM/SIGINT.
    registerShutdownHandlers(null, shutdownTasks);
    log.info("Worker process ready (no HTTP server)");
    log.info("-".repeat(50));
  }
}

main().catch((err) => {
  log.fatal({ err }, "Server startup failed");
  process.exit(1);
});
